const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

// Orders table for tracking print fulfillment
db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prodigi_order_id TEXT,
        user_email TEXT,
        recipient_name TEXT NOT NULL,
        certificate_type TEXT,
        domain_name TEXT,
        shipping_address TEXT,
        shipping_method TEXT,
        has_frame INTEGER DEFAULT 0,
        total_paid REAL,
        status TEXT DEFAULT 'pending',
        prodigi_status TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )
`);

// ===== EMAIL SETUP =====
// Configure your SMTP settings here when ready. Falls back to console logging.
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email', // Use Ethereal for testing
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@dotdeed.com';
const SITE_URL = process.env.SITE_URL || 'http://localhost:5000';

async function sendEmail({ to, subject, text, html }) {
    try {
        // Try sending via SMTP
        const info = await emailTransporter.sendMail({
            from: `"DOT DEED" <${FROM_EMAIL}>`,
            to,
            subject,
            text,
            html: html || text,
        });
        console.log(`✓ Email sent to ${to}: ${subject} (id: ${info.messageId})`);
        return true;
    } catch (err) {
        // If SMTP fails, log to console (useful in dev)
        console.log(`\n📧 EMAIL to ${to}:`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Body: ${text.substring(0, 500)}`);
        console.log(`   (SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS env vars)\n`);
        return false;
    }
}

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
        const user = db.prepare('SELECT username, email, registry_id FROM users WHERE id = ?').get(req.session.userId);
        if (user) {
            res.json({ username: user.username, email: user.email, registryId: user.registry_id });
        } else {
            res.json({ username: null, email: null, registryId: null });
        }
    } else {
        res.json({ username: null, email: null, registryId: null });
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

// Stripe Payment Intent (with Stripe Tax support)
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { amount, items, shipping } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        let totalCents = Math.round(amount * 100);
        let taxAmount = 0;

        // Try Stripe Tax (requires activation in Dashboard → Tax)
        if (shipping?.country) {
            try {
                const taxCalc = await stripe.tax.calculations.create({
                    currency: 'usd',
                    customer_details: {
                        address: {
                            line1: shipping?.address || 'N/A',
                            city: shipping?.city || 'N/A',
                            state: shipping?.state || 'CA',
                            postal_code: shipping?.zip || '94105',
                            country: shipping?.country || 'US',
                        },
                        address_source: 'shipping',
                    },
                    line_items: [{
                        amount: Math.round(amount * 100),
                        reference: 'certificate-order',
                        tax_behavior: 'exclusive',
                    }],
                });

                if (taxCalc?.tax_amount_exclusive > 0) {
                    taxAmount = taxCalc.tax_amount_exclusive / 100;
                    totalCents += taxCalc.tax_amount_exclusive;
                }
            } catch (taxErr) {
                // Stripe Tax not activated — skip tax
                console.log('Stripe Tax unavailable:', taxErr.message);
            }
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalCents,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            shipping: shipping?.name ? {
                name: shipping.name,
                address: {
                    line1: shipping.address || '',
                    city: shipping.city || '',
                    state: shipping.state || '',
                    postal_code: shipping.zip || '',
                    country: shipping.country || 'US',
                },
            } : undefined,
            metadata: { items: JSON.stringify(items || []) },
        });

        res.json({ 
            clientSecret: paymentIntent.client_secret,
            amount,
            taxAmount,
            totalAmount: amount + taxAmount,
        });

    } catch (err) {
        console.error('Payment intent error:', err);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// ===== PRODIGI PRINT API =====
const PRODIGI_API_KEY = '3cf0d3dd-a5c5-43e0-9c8b-a19449d80b79';
const PRODIGI_BASE = 'https://api.prodigi.com/v4.0';
const PRODIGI_SKU_FRAMED = 'GLOBAL-CFPM-8X10';
const PRODIGI_SKU_UNFRAMED = 'GLOBAL-FAP-8X10';

async function prodigiApi(path, options = {}) {
    const url = `${PRODIGI_BASE}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'X-API-Key': PRODIGI_API_KEY,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Prodigi API error (${res.status}): ${text.substring(0, 200)}`);
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('Invalid JSON from Prodigi: ' + text.substring(0, 100));
    }
}

// Get Prodigi shipping quote for a certificate
app.post('/api/prodigi-quote', async (req, res) => {
    try {
        const { destinationCountryCode, hasFrame } = req.body;
        if (!destinationCountryCode) {
            return res.status(400).json({ error: 'destinationCountryCode required' });
        }

        const sku = hasFrame ? PRODIGI_SKU_FRAMED : PRODIGI_SKU_UNFRAMED;
        const attributes = hasFrame ? { color: 'black' } : {};

        const result = await prodigiApi('/Quotes', {
            method: 'POST',
            body: JSON.stringify({
                destinationCountryCode,
                currencyCode: 'USD',
                items: [{
                    sku,
                    copies: 1,
                    attributes,
                    assets: [{ printArea: 'default' }]
                }]
            })
        });

        const quotes = (result.quotes || []).map(q => ({
            method: q.shipmentMethod,
            itemCost: parseFloat(q.costSummary.items.amount),
            shippingCost: parseFloat(q.costSummary.shipping.amount),
            totalCost: parseFloat(q.costSummary.totalCost.amount),
            carrier: q.shipments?.[0]?.carrier?.name || 'Unknown',
            service: q.shipments?.[0]?.carrier?.service || 'Unknown',
        }));

        res.json({ quotes });

    } catch (err) {
        console.error('Prodigi quote error:', err);
        res.status(500).json({ error: 'Failed to get shipping quote' });
    }
});

// Upload certificate image (from canvas data URL)
app.post('/api/upload-certificate', express.json({ limit: '10mb' }), (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) return res.status(400).json({ error: 'No image data' });

        // Decode base64 image
        const matches = imageData.match(/^data:image\/(png|jpeg);base64,(.+)$/);
        if (!matches) return res.status(400).json({ error: 'Invalid image format' });

        const ext = matches[1] === 'png' ? 'png' : 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `certificate-${Date.now()}.${ext}`;
        const filePath = path.join(__dirname, 'uploads', filename);

        // Ensure uploads directory exists
        const fs = require('fs');
        if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
            fs.mkdirSync(path.join(__dirname, 'uploads'));
        }

        fs.writeFileSync(filePath, buffer);

        const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
        res.json({ url: publicUrl, filename });

    } catch (err) {
        console.error('Upload certificate error:', err);
        res.status(500).json({ error: 'Failed to save certificate image' });
    }
});

// Place a Prodigi print order (call AFTER Stripe payment succeeds)
app.post('/api/prodigi-order', async (req, res) => {
    try {
        const { 
            recipientName, email, phoneNumber,
            address: { line1, line2, townOrCity, stateOrCounty, postalOrZipCode, countryCode },
            hasFrame, shippingMethod, certificateImageUrl,
            merchantReference, recipientCost,
            certificateType, domainName
        } = req.body;

        if (!recipientName || !line1 || !townOrCity || !postalOrZipCode || !countryCode || !certificateImageUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const sku = hasFrame ? PRODIGI_SKU_FRAMED : PRODIGI_SKU_UNFRAMED;
        const attributes = hasFrame ? { color: 'black' } : {};

        const orderPayload = {
            merchantReference: merchantReference || `DOTDEED-${Date.now()}`,
            shippingMethod: shippingMethod || 'Standard',
            recipient: {
                name: recipientName,
                email: email || null,
                phoneNumber: phoneNumber || null,
                address: {
                    line1,
                    line2: line2 || null,
                    postalOrZipCode,
                    countryCode,
                    townOrCity,
                    stateOrCounty: stateOrCounty || null,
                }
            },
            items: [{
                merchantReference: 'certificate-1',
                sku,
                copies: 1,
                sizing: 'fillPrintArea',
                attributes,
                recipientCost: recipientCost ? {
                    amount: recipientCost.amount,
                    currency: recipientCost.currency || 'USD'
                } : undefined,
                assets: [{
                    printArea: 'default',
                    url: certificateImageUrl,
                }]
            }],
            metadata: {
                source: 'dotdeed.com',
                type: 'domain-certificate',
            }
        };

        const result = await prodigiApi('/Orders', {
            method: 'POST',
            body: JSON.stringify(orderPayload)
        });

        const orderId = result.order?.id || null;
        const orderStatus = result.order?.status?.stage || null;

        // Store in database
        if (orderId) {
            const stmt = db.prepare(`
                INSERT INTO orders (prodigi_order_id, user_email, recipient_name, certificate_type, 
                    domain_name, shipping_address, shipping_method, has_frame, total_paid, status, prodigi_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                orderId,
                email || null,
                recipientName,
                req.body.certificateType || 'Essential',
                req.body.domainName || null,
                `${line1}, ${townOrCity}, ${stateOrCounty || ''} ${postalOrZipCode}, ${countryCode}`,
                shippingMethod || 'Standard',
                hasFrame ? 1 : 0,
                recipientCost?.amount ? parseFloat(recipientCost.amount) : 0,
                'submitted',
                orderStatus
            );

            // Send confirmation email
            const displayName = hasFrame ? 'Framed Print' : 'Fine Art Print (Scroll)';
            sendEmail({
                to: email || 'customer@unknown.local',
                subject: '🎉 Your DOT DEED certificate order is confirmed!',
                text: `Hi ${recipientName},

Your DOT DEED certificate order has been submitted for printing!

Order #: ${orderId}
Product: ${displayName}
Shipping: ${shippingMethod || 'Standard'}
Shipping to: ${line1}, ${townOrCity}, ${stateOrCounty || ''} ${postalOrZipCode}, ${countryCode}

We'll notify you when it's printing and when it ships.

Track your order: ${SITE_URL}/order-status?order=${orderId}

Thank you for choosing DOT DEED!`,
            });
        }

        res.json({
            outcome: result.outcome,
            orderId,
            status: orderStatus,
            prodigiOrder: result.order || null,
        });

    } catch (err) {
        console.error('Prodigi order error:', err);
        res.status(500).json({ error: 'Failed to create print order: ' + err.message });
    }
});

// Prodigi callback/webhook endpoint
// Configure this URL in your Prodigi Dashboard → Settings → Callback URL
// URL: http://yourdomain.com/api/prodigi-callback
app.post('/api/prodigi-callback', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        
        // Prodigi sends CloudEvents format
        const orderId = event.subject || event.data?.order?.id;
        const eventType = event.type || '';
        const orderData = event.data?.order || {};
        
        if (!orderId) {
            return res.status(200).json({ received: true }); // Acknowledge anyway
        }

        // Map event type to human-readable status
        const statusMap = {
            'com.prodigi.order.status.stage.changed#InProgress': 'in_progress',
            'com.prodigi.order.status.stage.changed#Complete': 'completed',
            'com.prodigi.order.status.stage.changed#Cancelled': 'cancelled',
        };

        const newStatus = statusMap[eventType] || orderData.status?.stage?.toLowerCase() || null;
        
        if (newStatus) {
            db.prepare('UPDATE orders SET prodigi_status = ?, updated_at = datetime("now") WHERE prodigi_order_id = ?')
                .run(newStatus, orderId);

            // Look up order to send email notification
            const order = db.prepare('SELECT * FROM orders WHERE prodigi_order_id = ?').get(orderId);
            
            if (order?.user_email) {
                let subject = '';
                let text = '';

                if (newStatus === 'in_progress') {
                    subject = '🖨️ Your DOT DEED certificate is printing!';
                    text = `Great news! Your DOT DEED certificate (Order #${orderId}) is now in production.

Our print partners are preparing your certificate with care. We'll notify you as soon as it ships.

Estimated delivery depends on your selected shipping method.

Thank you for your patience!`;
                } else if (newStatus === 'completed') {
                    subject = '📬 Your DOT DEED certificate is on its way!';
                    text = `Your DOT DEED certificate (Order #${orderId}) has been printed and shipped!

You'll receive it at:
${order.shipping_address}

We hope they love their DOT DEED certificate!

Track your order: ${SITE_URL}/order-status?order=${orderId}`;
                } else if (newStatus === 'cancelled') {
                    subject = '⚠️ Your DOT DEED order was cancelled';
                    text = `Your DOT DEED certificate order (Order #${orderId}) has been cancelled.

If you didn't request this cancellation, please contact support.

We apologize for the inconvenience.`;
                }

                if (subject && text) {
                    sendEmail({ to: order.user_email, subject, text });
                }
            }
        }

        res.status(200).json({ received: true });

    } catch (err) {
        console.error('Prodigi callback error:', err);
        res.status(200).json({ received: true }); // Always acknowledge webhooks
    }
});

// Look up order status (for frontend tracking)
app.get('/api/order-status', (req, res) => {
    try {
        const { order } = req.query;
        if (!order) return res.status(400).json({ error: 'Order ID required' });

        const orderData = db.prepare('SELECT * FROM orders WHERE prodigi_order_id = ?').get(order);
        if (!orderData) return res.status(404).json({ error: 'Order not found' });

        res.json({
            prodigiOrderId: orderData.prodigi_order_id,
            recipientName: orderData.recipient_name,
            certificateType: orderData.certificate_type,
            status: orderData.status,
            prodigiStatus: orderData.prodigi_status,
            shippingAddress: orderData.shipping_address,
            createdAt: orderData.created_at,
            updatedAt: orderData.updated_at,
        });
    } catch (err) {
        console.error('Order status error:', err);
        res.status(500).json({ error: 'Failed to look up order' });
    }
});

// ===== NAME.COM API =====
const NAMECOM_USER = 'strixxtheCEO-test';
const NAMECOM_TOKEN = 'dc77f73b4dcaab29cf43efc27338a7ad154f2da6';
const NAMECOM_AUTH = 'Basic ' + Buffer.from(NAMECOM_USER + ':' + NAMECOM_TOKEN).toString('base64');
const NAMECOM_API = 'https://api.dev.name.com/v4';

async function nameComApi(path, options = {}) {
    const url = `${NAMECOM_API}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': NAMECOM_AUTH,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'DOTDEED/1.0',
            ...options.headers,
        },
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Name.com API error (${res.status}): ${text.substring(0, 100)}`);
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('Invalid JSON response: ' + text.substring(0, 100));
    }
}

// Search domains on Name.com
app.get('/api/search-domains', async (req, res) => {
    try {
        const { keyword, tld, limit } = req.query;
        const searchTerm = keyword || '';
        const searchLimit = Math.min(parseInt(limit) || 20, 50);

        let results = [];
        
        // Try the search endpoint
        try {
            const body = JSON.stringify({
                keyword: searchTerm,
                tldFilter: tld ? [tld] : [],
                pageSize: searchLimit
            });
            const searchResults = await nameComApi('/domains:search', {
                method: 'POST',
                body,
            });
            results = (searchResults.results || []).map(d => ({
                name: d.domainName,
                price: d.purchasePrice || d.renewalPrice || Math.floor(Math.random() * 150) + 10,
                available: d.purchasable !== false,
                tld: '.' + d.domainName.split('.').pop(),
            }));
        } catch (e) {
            console.error('Search error:', e.message);
        }

        // If no results from search, return some suggested domains
        if (results.length === 0 && searchTerm) {
            const tlds = tld ? [tld] : ['.com', '.io', '.dev', '.app', '.co', '.ai', '.tech', '.design', '.life', '.xyz'];
            for (const ext of tlds.slice(0, 5)) {
                try {
                    const check = await nameComApi('/domains?domainName=' + encodeURIComponent(searchTerm + ext));
                    if (check && check.domainName) {
                        results.push({
                            name: check.domainName,
                            price: check.purchasePrice || 0,
                            available: check.purchasable !== false,
                            tld: ext,
                        });
                    }
                } catch (e) { /* skip */ }
            }
        }

        res.json({ domains: results });
    } catch (err) {
        console.error('Name.com search error:', err);
        res.json({ domains: [], error: 'Search temporarily unavailable' });
    }
});

// Check a single domain
app.post('/api/check-domain', async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });

        const body = JSON.stringify({
            keyword: domain.split('.')[0],
            tldFilter: ['.' + domain.split('.').pop()],
            pageSize: 5
        });
        const searchResults = await nameComApi('/domains:search', {
            method: 'POST',
            body,
        });
        
        const match = (searchResults.results || []).find(d => d.domainName === domain);
        if (match) {
            res.json({
                name: match.domainName,
                price: match.purchasePrice || match.renewalPrice || 0,
                available: match.purchasable !== false,
            });
        } else {
            res.json({ name: domain, price: 0, available: false });
        }
    } catch (err) {
        console.error('Name.com check error:', err);
        res.json({ error: 'Domain check failed' });
    }
});

// ===== STATIC FILES (after API routes) =====
// Don't serve index.html automatically — use index-new.html instead
app.use(express.static(__dirname, { index: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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