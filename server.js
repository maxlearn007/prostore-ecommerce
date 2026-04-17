const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Store user data in memory (for demo - use database in production)
let userData = [];
let cartData = [];

// Load existing data if file exists
if (fs.existsSync('users.json')) {
    userData = JSON.parse(fs.readFileSync('users.json'));
}
if (fs.existsSync('carts.json')) {
    cartData = JSON.parse(fs.readFileSync('carts.json'));
}

// Save data to files
function saveData() {
    fs.writeFileSync('users.json', JSON.stringify(userData, null, 2));
    fs.writeFileSync('carts.json', JSON.stringify(cartData, null, 2));
}

// API: Track user visits
app.post('/api/track', (req, res) => {
    const data = req.body;
    
    // Check if user exists
    const existingUser = userData.find(u => u.userId === data.userId);
    if (existingUser) {
        existingUser.lastSeen = data.timestamp;
        existingUser.visitCount = (existingUser.visitCount || 0) + 1;
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
    res.json({ success: true });
});

// API: Track cart actions
app.post('/api/cart', (req, res) => {
    cartData.push(req.body);
    saveData();
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

// Admin Dashboard HTML
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard | ProStore Analytics</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { background: #0f172a; font-family: 'Inter', sans-serif; }
        .sidebar {
            background: #1e293b;
            min-height: 100vh;
            padding: 1.5rem;
        }
        .sidebar h4 { color: #38bdf8; margin-bottom: 2rem; }
        .sidebar nav a {
            color: #94a3b8;
            display: block;
            padding: 0.75rem 1rem;
            text-decoration: none;
            border-radius: 0.5rem;
            margin-bottom: 0.5rem;
            transition: all 0.2s;
        }
        .sidebar nav a:hover, .sidebar nav a.active {
            background: #334155;
            color: white;
        }
        .main-content { padding: 2rem; }
        .stat-card {
            background: #1e293b;
            border-radius: 1rem;
            padding: 1.5rem;
            color: white;
            margin-bottom: 1rem;
        }
        .stat-card h3 { font-size: 2rem; margin-bottom: 0; color: #38bdf8; }
        .stat-card p { margin: 0; color: #94a3b8; }
        .table-container {
            background: #1e293b;
            border-radius: 1rem;
            padding: 1.5rem;
            margin-top: 1.5rem;
        }
        .table-container h5 { color: white; margin-bottom: 1rem; }
        .table { color: #cbd5e1; }
        .table thead th { border-bottom-color: #334155; }
        .badge-location { background: #0d6efd; }
        .refresh-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="row">
            <!-- Sidebar -->
            <div class="col-md-3 col-lg-2 px-0">
                <div class="sidebar">
                    <h4>📊 ProStore Analytics</h4>
                    <nav>
                        <a href="#" class="active" onclick="showSection('overview')">📈 Overview</a>
                        <a href="#" onclick="showSection('users')">👥 Users</a>
                        <a href="#" onclick="showSection('carts')">🛒 Cart Activity</a>
                        <a href="#" onclick="showSection('locations')">📍 Locations</a>
                        <a href="#" onclick="showSection('devices')">💻 Devices</a>
                    </nav>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="col-md-9 col-lg-10 main-content">
                <div id="overview-section">
                    <div class="row" id="stats-cards">
                        <div class="col-md-3">
                            <div class="stat-card">
                                <p>Total Users</p>
                                <h3 id="total-users">-</h3>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card">
                                <p>Total Visits</p>
                                <h3 id="total-visits">-</h3>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card">
                                <p>Cart Actions</p>
                                <h3 id="cart-actions">-</h3>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card">
                                <p>Active Last 24h</p>
                                <h3 id="active-users">-</h3>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row mt-4">
                        <div class="col-md-6">
                            <div class="table-container">
                                <h5>🏆 Top Products</h5>
                                <canvas id="productsChart" height="200"></canvas>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="table-container">
                                <h5>🌍 Top Countries</h5>
                                <canvas id="countriesChart" height="200"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="users-section" style="display:none;">
                    <div class="table-container">
                        <h5>👥 All Users</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr><th>User ID</th><th>First Seen</th><th>Last Seen</th><th>Visits</th><th>Location</th><th>Device</th></tr>
                                </thead>
                                <tbody id="users-table"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div id="carts-section" style="display:none;">
                    <div class="table-container">
                        <h5>🛒 Cart Activity Log</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead><tr><th>User ID</th><th>Product</th><th>Price</th><th>Time</th></tr></thead>
                                <tbody id="carts-table"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div id="locations-section" style="display:none;">
                    <div class="table-container">
                        <h5>📍 User Locations</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead><tr><th>User ID</th><th>IP Address</th><th>City</th><th>Country</th><th>Last Seen</th></tr></thead>
                                <tbody id="locations-table"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div id="devices-section" style="display:none;">
                    <div class="table-container">
                        <h5>💻 Device Information</h5>
                        <div class="table-responsive">
                            <table class="table">
                                <thead><tr><th>User ID</th><th>Browser</th><th>Screen</th><th>Language</th><th>Timezone</th></tr></thead>
                                <tbody id="devices-table"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <button class="btn btn-primary refresh-btn" onclick="loadAllData()">🔄 Refresh Data</button>
    
    <script>
        let productsChart, countriesChart;
        
        async function loadAllData() {
            // Load stats
            const statsRes = await fetch('/api/stats');
            const stats = await statsRes.json();
            document.getElementById('total-users').textContent = stats.totalUsers;
            document.getElementById('total-visits').textContent = stats.totalVisits;
            document.getElementById('cart-actions').textContent = stats.totalCartActions;
            document.getElementById('active-users').textContent = stats.visitsLast24h;
            
            // Load users
            const usersRes = await fetch('/api/users');
            const users = await usersRes.json();
            
            // Update users table
            const usersTable = document.getElementById('users-table');
            usersTable.innerHTML = users.map(u => \`
                <tr>
                    <td><small>\${u.userId?.substring(0, 8)}...</small></td>
                    <td><small>\${new Date(u.firstSeen).toLocaleString()}</small></td>
                    <td><small>\${new Date(u.lastSeen).toLocaleString()}</small></td>
                    <td>\${u.visitCount}</td>
                    <td>\${u.location?.city || 'Unknown'}, \${u.location?.country || 'Unknown'}</td>
                    <td><small>\${u.device?.browser?.substring(0, 30)}...</small></td>
                </tr>
            \`).join('');
            
            // Load carts
            const cartsRes = await fetch('/api/carts');
            const carts = await cartsRes.json();
            const cartsTable = document.getElementById('carts-table');
            cartsTable.innerHTML = carts.slice().reverse().map(c => \`
                <tr>
                    <td><small>\${c.userId?.substring(0, 8)}...</small></td>
                    <td>\${c.productName}</td>
                    <td>$\${c.productPrice}</td>
                    <td><small>\${new Date(c.timestamp).toLocaleString()}</small></td>
                </tr>
            \`).join('');
            
            // Update locations table
            const locationsTable = document.getElementById('locations-table');
            locationsTable.innerHTML = users.map(u => \`
                <tr>
                    <td><small>\${u.userId?.substring(0, 8)}...</small></td>
                    <td>\${u.ip || 'Unknown'}</td>
                    <td>\${u.location?.city || 'Unknown'}</td>
                    <td>\${u.location?.country || 'Unknown'}</td>
                    <td><small>\${new Date(u.lastSeen).toLocaleString()}</small></td>
                </tr>
            \`).join('');
            
            // Update devices table
            const devicesTable = document.getElementById('devices-table');
            devicesTable.innerHTML = users.map(u => \`
                <tr>
                    <td><small>\${u.userId?.substring(0, 8)}...</small></td>
                    <td><small>\${u.device?.browser?.substring(0, 40) || 'Unknown'}</small></td>
                    <td>\${u.device?.screen || 'Unknown'}</td>
                    <td>\${u.device?.language || 'Unknown'}</td>
                    <td><small>\${u.device?.timezone || 'Unknown'}</small></td>
                </tr>
            \`).join('');
            
            // Update charts
            if (productsChart) productsChart.destroy();
            if (countriesChart) countriesChart.destroy();
            
            const ctx1 = document.getElementById('productsChart').getContext('2d');
            productsChart = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: stats.topProducts.map(p => p.name),
                    datasets: [{
                        label: 'Times Added to Cart',
                        data: stats.topProducts.map(p => p.count),
                        backgroundColor: '#38bdf8'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: true }
            });
            
            // Country counts
            const countryCounts = {};
            users.forEach(u => {
                const country = u.location?.country || 'Unknown';
                countryCounts[country] = (countryCounts[country] || 0) + 1;
            });
            
            const ctx2 = document.getElementById('countriesChart').getContext('2d');
            countriesChart = new Chart(ctx2, {
                type: 'pie',
                data: {
                    labels: Object.keys(countryCounts),
                    datasets: [{
                        data: Object.values(countryCounts),
                        backgroundColor: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#34d399']
                    }]
                },
                options: { responsive: true }
            });
        }
        
        function showSection(section) {
            document.querySelectorAll('[id$="-section"]').forEach(el => el.style.display = 'none');
            document.getElementById(\`\${section}-section\`).style.display = 'block';
            document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
            event.target.classList.add('active');
        }
        
        loadAllData();
        setInterval(loadAllData, 30000); // Auto-refresh every 30 seconds
    </script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ Admin Dashboard running at http://localhost:${PORT}`);
    console.log(`📊 View dashboard: http://localhost:${PORT}/admin`);
});
