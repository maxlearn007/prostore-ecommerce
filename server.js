const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Store user data in memory (for demo - use database in production)
let userData = [];
let cartData = [];

// Load existing data if file exists
const usersFile = path.join(__dirname, 'users.json');
const cartsFile = path.join(__dirname, 'carts.json');

if (fs.existsSync(usersFile)) {
    try {
        userData = JSON.parse(fs.readFileSync(usersFile));
    } catch(e) { userData = []; }
}
if (fs.existsSync(cartsFile)) {
    try {
        cartData = JSON.parse(fs.readFileSync(cartsFile));
    } catch(e) { cartData = []; }
}

// Save data to files
function saveData() {
    fs.writeFileSync(usersFile, JSON.stringify(userData, null, 2));
    fs.writeFileSync(cartsFile, JSON.stringify(cartData, null, 2));
}

// API: Track user visits
app.post('/api/track', (req, res) => {
    const data = req.body;
    console.log('Tracking user:', data.userId);
    
    // Check if user exists
    const existingUser = userData.find(u => u.userId === data.userId);
    if (existingUser) {
        existingUser.lastSeen = data.timestamp;
        existingUser.visitCount = (existingUser.visitCount || 0) + 1;
        if (!existingUser.visits) existingUser.visits = [];
        existingUser.visits.push({
            timestamp: data.timestamp,
            page: data.page,
            ip: data.ip
        });
    } else {
        userData.push({
            ...data,
            firstSeen: data.timestamp,
            visitCount: 1,
            visits: [{
                timestamp: data.timestamp,
                page: data.page,
                ip: data.ip
            }]
        });
    }
    
    saveData();
    res.json({ success: true, message: 'Data tracked' });
});

// API: Track cart actions
app.post('/api/cart', (req, res) => {
    cartData.push(req.body);
    saveData();
    console.log('Cart action recorded:', req.body.productName);
    res.json({ success: true });
});

// API: Get all users (for admin dashboard)
app.get('/api/users', (req, res) => {
    res.json(userData);
});

// API: Get cart data
app.get('/api/carts', (req, res) => {
    res.json(cartData);
});

// API: Get dashboard stats
app.get('/api/stats', (req, res) => {
    const stats = {
        totalUsers: userData.length,
        totalVisits: userData.reduce((sum, u) => sum + (u.visitCount || 0), 0),
        totalCartActions: cartData.length,
        uniqueCountries: [...new Set(userData.map(u => u.location?.country).filter(Boolean))],
        topProducts: getTopProducts(),
        visitsLast24h: userData.filter(u => {
            if (!u.lastSeen) return false;
            const lastVisit = new Date(u.lastSeen);
            const now = new Date();
            return (now - lastVisit) < 24 * 60 * 60 * 1000;
        }).length
    };
    res.json(stats);
});

function getTopProducts() {
    const productCount = {};
    cartData.forEach(cart => {
        if (cart.productName) {
            productCount[cart.productName] = (productCount[cart.productName] || 0) + 1;
        }
    });
    return Object.entries(productCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
}

// Serve admin dashboard HTML
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`🛍️  Store Front: http://localhost:${PORT}`);
});
