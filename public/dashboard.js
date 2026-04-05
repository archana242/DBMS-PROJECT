// dashboard.js (Final Version with Session-Awareness)

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const licensePlateInput = document.getElementById('license-plate');
    const ownerIdInput = document.getElementById('owner-id');
    const findPlateInput = document.getElementById('find-plate');
    const findBtn = document.getElementById('find-btn');
    const dashboardContainer = document.getElementById('dashboard-container');
    const levelsContainer = document.getElementById('parking-levels-container');
    const appHeader = document.querySelector('.app-header');

    // --- CHECK SESSION & INITIALIZE ---
    // This is the main function that starts the page
    const checkSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();

            if (!data.loggedIn) {
                // Not logged in, send to login page
                window.location.href = 'index.html';
                return;
            }

            if (data.user.is_admin) {
                // This is an admin, send to admin page
                window.location.href = 'admin.html';
                return;
            }

            // --- User is a regular user, build the page ---
            
            // 1. Add Welcome Message and Logout Button
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <p>Welcome, <strong>${data.user.full_name}</strong></p>
                <button id="logout-btn" class="btn btn-danger">Log Out</button>
            `;
            appHeader.appendChild(userInfo);

            // 2. Add Event Listeners
            document.getElementById('logout-btn').addEventListener('click', logout);
            findBtn.addEventListener('click', findVehicle);
            
            // 3. Load the dashboard data
            refreshUI();

        } catch (err) {
            console.error('Session check failed:', err);
            window.location.href = 'index.html';
        }
    };

    // --- LOGOUT FUNCTION ---
    const logout = async () => {
        await fetch('/api/auth/logout');
        window.location.href = 'index.html';
    };

    // --- RENDER FUNCTIONS ---
    // (These functions now include session-expired checks)

    const renderDashboard = async () => {
        try {
            const response = await fetch('/api/stats');
            if (response.status === 401) {
                window.location.href = 'index.html'; // Session expired
                return;
            }
            const stats = await response.json();
            dashboardContainer.innerHTML = '';
            stats.forEach(levelStat => {
                const card = document.createElement('div');
                card.className = `stat-card level-${levelStat.level}`;
                card.innerHTML = `
                    <h3>Level ${levelStat.level}</h3>
                    <div class="stat-card-numbers">
                        <div><p style="color: var(--success-color);">${levelStat.available_spots}</p><span>Available</span></div>
                        <div><p style="color: var(--danger-color);">${levelStat.occupied_spots}</p><span>Occupied</span></div>
                        <div><p>${levelStat.total_spots}</p><span>Total</span></div>
                    </div>
                `;
                dashboardContainer.appendChild(card);
            });
        } catch (err) { console.error('Dashboard Error:', err); }
    };

    const renderParkingSpots = async () => {
        try {
            const response = await fetch('/api/spots');
            if (response.status === 401) {
                window.location.href = 'index.html'; // Session expired
                return;
            }
            const spots = await response.json();
            levelsContainer.innerHTML = '';
            const spotsByLevel = spots.reduce((acc, spot) => {
                (acc[spot.level] = acc[spot.level] || []).push(spot);
                return acc;
            }, {});

            for (const level in spotsByLevel) {
                const levelDiv = document.createElement('div');
                levelDiv.className = 'parking-level';
                levelDiv.innerHTML = `<h2>Parking Level ${level}</h2>`;
                const spotsGrid = document.createElement('div');
                spotsGrid.className = 'spots-grid';
                spotsByLevel[level].forEach(spot => {
                    const spotDiv = document.createElement('div');
                    spotDiv.className = `spot ${spot.spot_type} ${spot.is_occupied ? 'occupied' : 'available'}`;
                    spotDiv.textContent = spot.spot_number;
                    spotDiv.dataset.spotId = spot.spot_id;
                    if (spot.is_occupied) {
                        spotDiv.addEventListener('click', () => checkOut(spot.spot_id));
                    } else {
                        spotDiv.addEventListener('click', () => checkIn(spot.spot_id));
                    }
                    spotsGrid.appendChild(spotDiv);
                });
                levelDiv.appendChild(spotsGrid);
                levelsContainer.appendChild(levelDiv);
            }
        } catch (err) { console.error('Parking Spots Error:', err); }
    };

    // --- CORE LOGIC FUNCTIONS ---
    const refreshUI = () => {
        renderDashboard();
        renderParkingSpots();
    };

    const checkIn = async (spotId) => {
        const licensePlate = licensePlateInput.value.trim();
        const ownerId = ownerIdInput.value.trim();
        if (!licensePlate || !ownerId) {
            alert('Error: License Plate and Student/Staff ID are both required.');
            return;
        }
        const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_plate: licensePlate, spot_id: spotId, owner_id: ownerId })
        });
        if (response.status === 401) {
            window.location.href = 'index.html'; // Session expired
            return;
        }
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            licensePlateInput.value = '';
            ownerIdInput.value = '';
            refreshUI();
        } else {
            alert('Error: ' + result.error);
        }
    };

    const checkOut = async (spotId) => {
        const authorizingId = prompt("To check out, please enter the authorizing Student/Staff ID:");
        if (!authorizingId) return;
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spot_id: spotId, owner_id: authorizingId.trim() })
        });
        if (response.status === 401) {
            window.location.href = 'index.html'; // Session expired
            return;
        }
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            refreshUI();
        } else {
            alert('Error: ' + result.error);
        }
    };

    const findVehicle = async () => {
        const plate = findPlateInput.value.trim();
        if (!plate) {
            alert('Please enter a license plate to find.');
            return;
        }
        const response = await fetch(`/api/find/${plate}`);
        if (response.status === 401) {
            window.location.href = 'index.html'; // Session expired
            return;
        }
        if (response.ok) {
            const data = await response.json();
            alert(`Vehicle ${plate} (Owner: ${data.owner_id || 'N/A'}) is parked in Spot ${data.spot_number} on Level ${data.level}.`);
        } else {
            const result = await response.json();
            alert(`Error: ${result.error}`);
        }
        findPlateInput.value = '';
    };

    // --- INITIALIZATION ---
    checkSession(); // This is now the only function that runs on load
});
