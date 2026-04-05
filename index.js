// index.js (Upgraded with Login, Sessions, and Admin Routes)

const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session'); // Import the new session package

const app = express();
const port = 3000;

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', // Make sure this is your correct password
    database: 'parking_db'
}).promise();

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- SESSION MIDDLEWARE SETUP ---
app.use(session({
    secret: 'your-secret-key-change-this', // Change this to a random string
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 1000 * 60 * 60 * 24 // Cookie lasts for 1 day
    }
}));

// --- AUTHENTICATION MIDDLEWARE ---
// Middleware to check if a user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        next(); // User is logged in, proceed to the route
    } else {
        res.status(401).json({ error: 'You are not authorized. Please log in.' });
    }
};

// Middleware to check if a user is an admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.is_admin) {
        next(); // User is an admin, proceed
    } else {
        res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
};

// --- AUTHENTICATION API ROUTES ---

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
        return res.status(400).json({ error: 'User ID and password are required.' });
    }
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE user_id = ?', [user_id]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid User ID or password.' });
        }
        
        const user = rows[0];
        
        // Plain text password check (fine for lab, but use bcrypt in real world)
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid User ID or password.' });
        }
        
        // Store user data in session (excluding password)
        req.session.user = {
            user_id: user.user_id,
            full_name: user.full_name,
            user_role: user.user_role,
            is_admin: user.is_admin
        };
        
        res.json({ success: true, user: req.session.user });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/logout
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to log out.' });
        }
        res.clearCookie('connect.sid'); // Clears the session cookie
        res.json({ success: true, message: 'Logged out successfully.' });
    });
});

// GET /api/auth/session - Checks who is currently logged in
app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- PROTECTED MAIN API ROUTES ---
// All main APIs now use the 'isLoggedIn' middleware

// GET all parking spots
app.get('/api/spots', isLoggedIn, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM parking_spots ORDER BY level, spot_number');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET statistics for the dashboard
app.get('/api/stats', isLoggedIn, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT level, COUNT(*) AS total_spots, SUM(is_occupied) AS occupied_spots
             FROM parking_spots GROUP BY level ORDER BY level`
        );
        const stats = rows.map(row => ({
            ...row,
            available_spots: row.total_spots - row.occupied_spots
        }));
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST a new vehicle check-in
app.post('/api/checkin', isLoggedIn, async (req, res) => {
    const { license_plate, spot_id, owner_id } = req.body;
    // ... (rest of your check-in logic is identical) ...
    if (!license_plate || !spot_id || !owner_id) {
        return res.status(400).json({ error: 'License Plate and Student/Staff ID are both required.' });
    }
    try {
        const [activeCars] = await db.query('SELECT * FROM vehicles WHERE license_plate = ? AND check_out_time IS NULL', [license_plate]);
        if (activeCars.length > 0) {
            return res.status(409).json({ error: `Vehicle ${license_plate} is already parked.` });
        }
        const [users] = await db.query('SELECT user_role FROM users WHERE user_id = ?', [owner_id]);
        if (users.length === 0) {
            return res.status(404).json({ error: `User with ID ${owner_id} not found.` });
        }
        const userRole = users[0].user_role;
        const [spots] = await db.query('SELECT spot_type FROM parking_spots WHERE spot_id = ?', [spot_id]);
        const spotType = spots[0].spot_type;
        if (userRole !== spotType && spotType !== 'general') {
            return res.status(403).json({ error: `A ${userRole} is not allowed to park in a designated ${spotType} spot.` });
        }
        await db.query('UPDATE parking_spots SET is_occupied = TRUE WHERE spot_id = ?', [spot_id]);
        await db.query(
            'INSERT INTO vehicles (license_plate, owner_id, check_in_time, spot_id) VALUES (?, ?, NOW(), ?)',
            [license_plate, owner_id, spot_id]
        );
        res.json({ success: true, message: `Vehicle ${license_plate} checked in.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST a vehicle check-out
app.post('/api/checkout', isLoggedIn, async (req, res) => {
    const { spot_id, owner_id } = req.body;
    // ... (rest of your checkout logic is identical) ...
    if (!spot_id || !owner_id) {
        return res.status(400).json({ error: 'Spot ID and authorizing Owner ID are required.' });
    }
    try {
        const [rows] = await db.query('SELECT * FROM vehicles WHERE spot_id = ? AND check_out_time IS NULL', [spot_id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No active vehicle found in this spot.' });
        }
        const vehicle = rows[0];
        if (vehicle.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Authorization failed. The provided ID does not match the parker\'s ID.' });
        }
        await db.query('UPDATE parking_spots SET is_occupied = FALSE WHERE spot_id = ?', [vehicle.spot_id]);
        await db.query('UPDATE vehicles SET check_out_time = NOW() WHERE vehicle_id = ?', [vehicle.vehicle_id]);
        res.json({ success: true, message: `Vehicle ${vehicle.license_plate} checked out successfully.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET the location of a specific vehicle
app.get('/api/find/:plate', isLoggedIn, async (req, res) => {
    const plate = req.params.plate;
    // ... (rest of your find logic is identical) ...
    try {
        const [rows] = await db.query(
            `SELECT p.spot_number, p.level, v.owner_id FROM vehicles v JOIN parking_spots p ON v.spot_id = p.spot_id WHERE v.license_plate = ? AND v.check_out_time IS NULL`,
            [plate]
        );
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Vehicle not found or is not currently parked.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- NEW ADMIN-ONLY API ROUTES ---
// Protected by 'isLoggedIn' and 'isAdmin' middleware

// GET all vehicle history (for admin)
app.get('/api/admin/all-vehicles', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT v.*, p.spot_number, p.level
             FROM vehicles v
             JOIN parking_spots p ON v.spot_id = p.spot_id
             ORDER BY v.check_in_time DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all users (for admin)
app.get('/api/admin/all-users', isLoggedIn, isAdmin, async (req, res) => {
    try {
        // Select all users but EXCLUDE the password
        const [rows] = await db.query('SELECT user_id, full_name, user_role, is_admin FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- START THE SERVER ---
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port} 🚗`);
});