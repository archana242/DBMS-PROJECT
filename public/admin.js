// admin.js

document.addEventListener('DOMContentLoaded', () => {
    const adminName = document.getElementById('admin-name');
    const logoutBtn = document.getElementById('logout-btn');
    const vehicleHistoryBody = document.getElementById('vehicle-history-body');
    const allUsersBody = document.getElementById('all-users-body');

    // --- Check Session ---
    // This function checks if the user is logged in and is an admin
    const checkSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            if (!res.ok) {
                // If the server sends an error (like 401), redirect
                window.location.href = 'index.html'; // Not logged in
                return;
            }
            const data = await res.json();
            if (data.loggedIn && data.user.is_admin) {
                // User is an admin, set their name and load data
                adminName.textContent = data.user.full_name;
                loadVehicleHistory();
                loadAllUsers();
            } else {
                // Not an admin or not logged in, boot to login page
                window.location.href = 'index.html';
            }
        } catch (err) {
            console.error('Session check failed:', err);
            window.location.href = 'index.html';
        }
    };

    // --- Load Vehicle History ---
    const loadVehicleHistory = async () => {
        try {
            const res = await fetch('/api/admin/all-vehicles');
            const vehicles = await res.json();
            vehicleHistoryBody.innerHTML = ''; // Clear table
            
            if (res.ok) {
                vehicles.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${v.vehicle_id}</td>
                        <td>${v.license_plate}</td>
                        <td>${v.owner_id}</td>
                        <td>${v.spot_number}</td>
                        <td>${v.level}</td>
                        <td>${new Date(v.check_in_time).toLocaleString()}</td>
                        <td>${v.check_out_time ? new Date(v.check_out_time).toLocaleString() : 'Still Parked'}</td>
                    `;
                    vehicleHistoryBody.appendChild(tr);
                });
            } else {
                alert(vehicles.error);
            }
        } catch (err) {
            console.error('Failed to load vehicle history:', err);
        }
    };

    // --- Load All Users ---
    const loadAllUsers = async () => {
        try {
            const res = await fetch('/api/admin/all-users');
            const users = await res.json();
            allUsersBody.innerHTML = ''; // Clear table
            
            if (res.ok) {
                users.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${u.user_id}</td>
                        <td>${u.full_name}</td>
                        <td>${u.user_role}</td>
                        <td>${u.is_admin ? 'Yes' : 'No'}</td>
                    `;
                    allUsersBody.appendChild(tr);
                });
            } else {
                alert(users.error);
            }
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    // --- Logout ---
    const logout = async () => {
        await fetch('/api/auth/logout');
        window.location.href = 'index.html';
    };

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', logout);

    // --- Initial Load ---
    checkSession();
});