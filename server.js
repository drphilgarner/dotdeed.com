const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const Stripe = require('stripe');

// ===== SETUP =====
const app = express();
const PORT = 5000;
const db = new Database('dotdeed.db');

const GOOGLE_CLIENT_ID = '225372944068-dinr71d04igfu2733q3f4a4bb8b25cg2.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const stripe = Stripe('sk_test_51Txa9ZRDgGi4zkad3zoe7sU9ZsMvgy4XkzqSEL4E1yiGy6czbZAxcfl1c2YaJwfGdIW7iQneZVbzAXS34ByoLsh800iMcxliz5');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'dotdeed-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// ===== DATABASE SETUP =====
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        registry_id TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )
`);

// Add email column if upgrading existing DB
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''"); } catch(e) {}
// Add google_id column if upgrading existing DB
try { db.exec("ALTER TABLE users ADD COLUMN google_id TEXT"); } catch(e) {}

// Helper: generate a unique Registry ID
function generateRegistryId() {
    const year = new Date().getFullYear();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let random = '';
    for (let i = 0; i < 4; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const id = `REG-${year}-${random}`;
    const existing = db.prepare('SELECT id FROM users WHERE registry_id = ?').get(id);
    return existing ? generateRegistryId() : id;
}

// ===== AUTH MIDDLEWARE =====
function requireAuth(req, res, next) {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'Not authenticated' });
}

// ===== API ROUTES =====

// Test route
app.get('/api/ping', (req, res) => {
    res.json({ pong: true });
});

// Sign Up
app.post('/api/signup', (req, res) => {
    try {
        const { username, password, email } = req.body;

        if (!username || username.length < 3)
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        if (!password || password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        if (!email || !email.includes('@'))
            return res.status(400).json({ error: 'A valid email address is required' });

        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing)
            return res.status(409).json({ error: 'Username already taken' });

        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingEmail)
            return res.status(409).json({ error: 'Email already registered' });

        const passwordHash = bcrypt.hashSync(password, 10);
        const registryId = generateRegistryId();

        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash, registry_id) VALUES (?, ?, ?, ?)'
        ).run(username, email, passwordHash, registryId);

        req.session.userId = result.lastInsertRowid;
        req.session.username = username;
        req.session.registryId = registryId;

        res.json({ username, registryId, message: 'Account created successfully' });

    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Sign In
app.post('/api/signin', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user || !bcrypt.compareSync(password, user.password_hash))
            return res.status(401).json({ error: 'Invalid username or password' });

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.registryId = user.registry_id;

        res.json({ username: user.username, registryId: user.registry_id });

    } catch (err) {
        console.error('Signin error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user (check session on page load)
app.get('/api/me', (req, res) => {
    if (req.session.userId) {
        res.json({ username: req.session.username, registryId: req.session.registryId });
    } else {
        res.json({ username: null, registryId: null });
    }
});

// Sign Out
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ message: 'Signed out' }));
});

// Guest Login (for testing)
app.post('/api/guest', (req, res) => {
    try {
        const guestNum = Date.now().toString(36).toUpperCase();
        const username = `Guest-${guestNum.slice(-4)}`;
        const email = `${username.toLowerCase()}@guest.local`;
        const passwordHash = bcrypt.hashSync('guest', 10);
        const registryId = generateRegistryId();

        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash, registry_id) VALUES (?, ?, ?, ?)'
        ).run(username, email, passwordHash, registryId);

        req.session.userId = result.lastInsertRowid;
        req.session.username = username;
        req.session.registryId = registryId;

        res.json({ username, registryId, message: 'Logged in as guest' });

    } catch (err) {
        console.error('Guest login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Google Sign-In
app.post('/api/google-signin', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Missing credential' });

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = payload.email;
        const name = payload.name || email.split('@')[0];

        // Check if user exists by google_id or email
        let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
        
        if (!user) {
            // Check by email
            user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            if (user) {
                // Link Google ID to existing account
                db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
            } else {
                // Create new account
                const passwordHash = bcrypt.hashSync(googleId + Date.now(), 10);
                const registryId = generateRegistryId();
                const result = db.prepare(
                    'INSERT INTO users (username, email, password_hash, registry_id, google_id) VALUES (?, ?, ?, ?, ?)'
                ).run(name, email, passwordHash, registryId, googleId);
                user = { id: result.lastInsertRowid, username: name, email, registry_id: registryId };
                // Add google_id column if missing
                try { db.exec("ALTER TABLE users ADD COLUMN google_id TEXT"); } catch(e) {}
            }
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.registryId = user.registry_id;

        res.json({ username: user.username, registryId: user.registry_id });

    } catch (err) {
        console.error('Google sign-in error:', err);
        res.status(500).json({ error: 'Google sign-in failed' });
    }
});

// Stripe Payment Intent
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { amount, items, shipping } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe uses cents
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                items: JSON.stringify(items || []),
                shipping: JSON.stringify(shipping || {}),
            },
        });

        res.json({ clientSecret: paymentIntent.client_secret });

    } catch (err) {
        console.error('Payment intent error:', err);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// ===== STATIC FILES (after API routes) =====
// Don't serve index.html automatically — use index-new.html instead
app.use(express.static(__dirname, { index: false }));

// Serve index-new.html as the default page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index-new.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log('\n\u2713 DOT DEED marketplace hosted locally');
    console.log(`\u2192 Open your browser: http://localhost:${PORT}`);
    console.log('\u2192 Database: dotdeed.db (SQLite)\n');
});