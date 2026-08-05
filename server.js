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
const PORT = Number(process.env.PORT) || 5000;
const isVercel = Boolean(process.env.VERCEL);
const databasePath = isVercel
    ? path.join('/tmp', 'dotdeed.db')
    : path.join(__dirname, 'dotdeed.db');
const db = new Database(databasePath);

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
// Add prodigi_payload column if upgrading existing DB
try { db.exec("ALTER TABLE orders ADD COLUMN prodigi_payload TEXT"); } catch(e) {}

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
        claim_token TEXT,
        prodigi_payload TEXT,
        status TEXT DEFAULT 'pending',
        prodigi_status TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )
`);

// Claims table for domain gifting
db.exec(`
    CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_name TEXT NOT NULL,
        claim_token TEXT UNIQUE NOT NULL,
        buyer_name TEXT,
        buyer_email TEXT,
        recipient_email TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now')),
        claimed_at TEXT
    )
`);

// Purchased domains table
db.exec(`
    CREATE TABLE IF NOT EXISTS purchased_domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_name TEXT UNIQUE NOT NULL,
        namecom_domain_id TEXT,
        purchase_price REAL,
        purchase_years INTEGER DEFAULT 1,
        registrant_name TEXT,
        registrant_email TEXT,
        epp_code TEXT,
        status TEXT DEFAULT 'pending',
        order_id INTEGER,
        claim_token TEXT,
        created_at TEXT DEFAULT (datetime('now'))
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
    
    // Log Prodigi requests to console for debugging
    if (options.body) {
        try {
            const parsed = JSON.parse(options.body);
            console.log(`\n📤 Prodigi ${options.method || 'GET'} ${path}`);
            console.log(`   SKU: ${parsed.items?.[0]?.sku || 'N/A'}`);
            console.log(`   Recipient: ${parsed.recipient?.name || 'N/A'}`);
            console.log(`   Address: ${parsed.recipient?.address?.line1 || 'N/A'}, ${parsed.recipient?.address?.townOrCity || 'N/A'}`);
            console.log(`   Image URL: ${parsed.items?.[0]?.assets?.[0]?.url?.substring(0, 80) || 'N/A'}...`);
            console.log(`   Attributes: ${JSON.stringify(parsed.items?.[0]?.attributes || {})}`);
        } catch (e) {}
    }
    
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
            hasFrame, frameColor, shippingMethod, certificateImageUrl,
            merchantReference, recipientCost,
            certificateType, domainName
        } = req.body;

        if (!recipientName || !line1 || !townOrCity || !postalOrZipCode || !countryCode || !certificateImageUrl) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const sku = hasFrame ? PRODIGI_SKU_FRAMED : PRODIGI_SKU_UNFRAMED;
        const attributes = hasFrame ? { color: frameColor || 'black' } : {};

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
            const payloadStr = JSON.stringify(orderPayload);
            const stmt = db.prepare(`
                INSERT INTO orders (prodigi_order_id, user_email, recipient_name, certificate_type, 
                    domain_name, shipping_address, shipping_method, has_frame, total_paid, prodigi_payload, status, prodigi_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                payloadStr,
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

// ===== DOMAIN CLAIM SYSTEM (QR code gifting) =====
// Generate a unique claim token for a purchased domain
app.post('/api/create-claim', (req, res) => {
    try {
        const { domainName, buyerName, buyerEmail } = req.body;
        if (!domainName) return res.status(400).json({ error: 'Domain name required' });

        const token = crypto.randomBytes(16).toString('hex');
        const claimUrl = `${SITE_URL}/claim?token=${token}`;

        db.prepare(`
            INSERT INTO claims (domain_name, claim_token, buyer_name, buyer_email, status)
            VALUES (?, ?, ?, ?, 'pending')
        `).run(domainName, token, buyerName || null, buyerEmail || null);

        res.json({ token, claimUrl, domainName });
    } catch (err) {
        console.error('Create claim error:', err);
        res.status(500).json({ error: 'Failed to create claim' });
    }
});

// Look up a claim by token (for the QR code claim page)
app.get('/api/claim/:token', (req, res) => {
    try {
        const claim = db.prepare('SELECT * FROM claims WHERE claim_token = ?').get(req.params.token);
        if (!claim) return res.status(404).json({ error: 'Invalid or expired claim link' });

        res.json({
            domainName: claim.domain_name,
            buyerName: claim.buyer_name,
            status: claim.status,
            createdAt: claim.created_at,
            // Only show recipient email if already claimed
            recipientEmail: claim.recipient_email || null,
        });
    } catch (err) {
        console.error('Claim lookup error:', err);
        res.status(500).json({ error: 'Failed to look up claim' });
    }
});

// Claim a domain (recipient activates it + triggers transfer)
app.post('/api/claim/:token', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }

        const claim = db.prepare('SELECT * FROM claims WHERE claim_token = ?').get(req.params.token);
        if (!claim) return res.status(404).json({ error: 'Invalid claim link' });
        if (claim.status !== 'pending') return res.status(400).json({ error: 'Domain already claimed' });

        // Mark as claimed
        db.prepare(`
            UPDATE claims SET status = 'claimed', recipient_email = ?, claimed_at = datetime('now')
            WHERE claim_token = ?
        `).run(email, req.params.token);

        // Trigger domain transfer (send EPP code to recipient)
        let transferMsg = '';
        try {
            const transferRes = await fetch(`${SITE_URL}/api/transfer-domain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimToken: req.params.token, recipientEmail: email }),
            });
            const transferData = await transferRes.json();
            if (transferData.success) {
                transferMsg = '\n\nCheck your email for transfer instructions.';
            }
        } catch (transferErr) {
            console.log('Transfer trigger failed (manual setup needed):', transferErr.message);
        }

        // Send confirmation to buyer
        if (claim.buyer_email) {
            sendEmail({
                to: claim.buyer_email,
                subject: `🎁 ${claim.domain_name} has been claimed!`,
                text: `Great news! The recipient has claimed ${claim.domain_name}!${transferMsg}\n\nThank you for using DOT DEED!`,
            });
        }

        // Send welcome to recipient
        sendEmail({
            to: email,
            subject: `🎉 You've received ${claim.domain_name}!`,
            text: `Congratulations!\n\n${claim.buyer_name || 'Someone'} has gifted you the domain ${claim.domain_name}!${transferMsg}\n\n${SITE_URL}/claim?token=${claim.claim_token}`,
        });

        res.json({ message: 'Domain claimed successfully!' + transferMsg, domainName: claim.domain_name });
    } catch (err) {
        console.error('Claim error:', err);
        res.status(500).json({ error: 'Failed to claim domain' });
    }
});

// ===== NAME.COM API =====
const NAMECOM_USER = 'strixxtheCEO';
const NAMECOM_TOKEN = 'e91ae7f7d17593ac5028109ad564e258b8752689';
const NAMECOM_AUTH = 'Basic ' + Buffer.from(NAMECOM_USER + ':' + NAMECOM_TOKEN).toString('base64');
const NAMECOM_API = 'https://api.name.com/v4';

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

// ===== DOMAIN PURCHASE + TRANSFER (relies on nameComApi above) =====
// Get a domain price (uses search endpoint)
app.post('/api/domain-price', async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain required' });

        const body = JSON.stringify({
            keyword: domain.split('.')[0],
            tldFilter: ['.' + domain.split('.').pop()],
            pageSize: 5
        });
        const data = await nameComApi('/domains:search', { method: 'POST', body });
        const match = (data.results || []).find(d => d.domainName === domain);
        
        res.json({
            domain,
            price: match?.purchasePrice || 0,
            available: match?.purchasable === true,
        });
    } catch (err) {
        console.error('Domain price error:', err);
        res.status(500).json({ error: 'Failed to get domain price' });
    }
});

// Purchase a domain via Name.com API
app.post('/api/purchase-domain', async (req, res) => {
    try {
        const { domain, years, registrantName, registrantEmail, registrantPhone, 
                addressLine1, addressCity, addressState, addressZip, addressCountry,
                claimToken } = req.body;

        if (!domain) return res.status(400).json({ error: 'Domain name required' });
        if (!registrantName || !registrantEmail) 
            return res.status(400).json({ error: 'Registrant contact info required' });

        // Get purchase price first
        let purchasePrice = 0;
        try {
            const priceRes = await fetch(`${SITE_URL}/api/domain-price`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain }),
            });
            const priceData = await priceRes.json();
            purchasePrice = priceData.price || 0;
        } catch (e) {
            console.log('Price check unavailable, proceeding with purchase attempt');
        }

        // Attempt to purchase via Name.com API
        let purchaseSuccess = false;
        let domainId = null;
        let purchaseError = null;

        if (purchasePrice > 0) {
            try {
                const nameParts = registrantName.trim().split(' ');
                const firstName = nameParts[0] || registrantName;
                const lastName = nameParts.slice(1).join(' ') || 'Gift Recipient';

                const purchaseBody = JSON.stringify({
                    domain: {
                        domainName: domain,
                        purchaseYears: years || 1,
                        contacts: [{
                            type: 'registrant',
                            firstName,
                            lastName,
                            email: registrantEmail,
                            phone: registrantPhone || '+1.5551234567',
                            address: {
                                line1: addressLine1 || '123 Default St',
                                city: addressCity || 'Anytown',
                                state: addressState || 'CA',
                                zip: addressZip || '12345',
                                country: addressCountry || 'US',
                            },
                        }],
                        adminContact: 'same',
                        techContact: 'same',
                        billingContact: 'same',
                    },
                });

                const result = await nameComApi('/domains', { method: 'POST', body: purchaseBody });
                domainId = result?.domain?.id || null;
                purchaseSuccess = true;
            } catch (e) {
                purchaseError = e.message;
                console.log('Name.com purchase failed:', e.message);
            }
        }

        // Store in purchased_domains table regardless
        db.prepare(`
            INSERT INTO purchased_domains 
                (domain_name, namecom_domain_id, purchase_price, purchase_years, 
                 registrant_name, registrant_email, status, claim_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            domain, domainId, purchasePrice, years || 1,
            registrantName, registrantEmail,
            purchaseSuccess ? 'purchased' : 'pending',
            claimToken || null
        );

        if (purchaseSuccess) {
            res.json({
                success: true,
                domain,
                domainId,
                price: purchasePrice,
                message: `${domain} registered successfully!`,
            });
        } else {
            res.json({
                success: true,
                domain,
                pending: true,
                price: purchasePrice,
                message: purchasePrice > 0 
                    ? `${domain} queued — we'll complete registration shortly.`
                    : `${domain} queued for registration. We'll register it once payment is confirmed.`,
            });
        }

    } catch (err) {
        console.error('Domain purchase error:', err);
        res.status(500).json({ error: 'Failed to process domain purchase' });
    }
});

// Transfer domain to recipient (called when claim is made)
app.post('/api/transfer-domain', async (req, res) => {
    try {
        const { claimToken, recipientEmail } = req.body;
        if (!claimToken) return res.status(400).json({ error: 'Claim token required' });

        const purchase = db.prepare('SELECT * FROM purchased_domains WHERE claim_token = ?').get(claimToken);
        if (!purchase) return res.status(400).json({ error: 'No domain found for this claim' });

        const domain = purchase.domain_name;

        // Get or generate EPP code from Name.com
        let eppCode = purchase.epp_code;
        if (!eppCode) {
            try {
                const eppResult = await nameComApi(`/domains/${domain}`, { method: 'GET' });
                eppCode = eppResult?.domain?.authCode || 'CONTACT-SUPPORT-FOR-EPP';
            } catch (e) {
                eppCode = 'CONTACT-SUPPORT-FOR-EPP';
            }
            db.prepare('UPDATE purchased_domains SET epp_code = ? WHERE domain_name = ?')
                .run(eppCode, domain);
        }

        // Mark as transferred
        db.prepare(`
            UPDATE purchased_domains SET status = 'transferred' WHERE domain_name = ?
        `).run(domain);

        // Send transfer instructions to recipient
        sendEmail({
            to: recipientEmail,
            subject: `📋 How to claim your domain: ${domain}`,
            text: `You've been gifted the domain ${domain}!

Here's how to take ownership:

1. Choose a registrar (Namecheap, GoDaddy, Google Domains, Cloudflare, etc.)
2. Go to their domain transfer page
3. Enter the domain name: ${domain}
4. Use this authorization (EPP) code: ${eppCode}
5. Pay the transfer fee (usually ~$8-12 for a .com, includes a year renewal)
6. The domain will transfer within 5-7 days

Need help? Reply to this email or visit ${SITE_URL}/help

Enjoy your new domain! 🎉`,
        });

        // Notify buyer
        const claim = db.prepare('SELECT buyer_email FROM claims WHERE claim_token = ?').get(claimToken);
        if (claim?.buyer_email) {
            sendEmail({
                to: claim.buyer_email,
                subject: `�� Transfer instructions sent for ${domain}`,
                text: `Your gifted domain ${domain} has been claimed!\n\nThe recipient has been sent the transfer authorization code.\n\nThey'll need to initiate a transfer at their chosen registrar using the EPP code.`,
            });
        }

        res.json({
            success: true,
            domain,
            message: 'Transfer instructions sent to recipient!',
        });

    } catch (err) {
        console.error('Domain transfer error:', err);
        res.status(500).json({ error: 'Failed to process domain transfer' });
    }
});

// ===== DOMAIN SEARCH (used by frontend domain shopper) =====
app.get('/api/search-domains', async (req, res) => {
    try {
        const { keyword, tld, limit } = req.query;
        const searchTerm = keyword || '';
        const searchLimit = Math.min(parseInt(limit) || 20, 50);

        let results = [];
        
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
                price: d.purchasePrice || d.renewalPrice || 0,
                available: d.purchasable === true,
                premium: d.premium === true,
                tld: '.' + d.domainName.split('.').pop(),
            }));
        } catch (e) {
            console.error('Search error:', e.message);
        }

        res.json({ domains: results });
    } catch (err) {
        console.error('Name.com search error:', err);
        res.json({ domains: [], error: 'Search temporarily unavailable' });
    }
});

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
                available: match.purchasable === true,
                premium: match.premium === true,
            });
        } else {
            res.json({ name: domain, price: 0, available: false });
        }
    } catch (err) {
        console.error('Name.com check error:', err);
        res.json({ error: 'Domain check failed' });
    }
});

// ===== ADMIN PANEL =====
const ADMIN_PASSWORD = 'dotdeed2026'; // Change this in production

app.post('/api/admin/login', express.json(), (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    res.json({ success: true });
});

function requireAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/admin/orders', requireAdmin, (req, res) => {
    const orders = db.prepare(`
        SELECT id, prodigi_order_id, user_email, recipient_name, certificate_type, 
               domain_name, shipping_method, has_frame, total_paid, status, prodigi_status,
               created_at, updated_at
        FROM orders ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json({ orders });
});

app.get('/api/admin/order-payload/:id', requireAdmin, (req, res) => {
    const order = db.prepare('SELECT prodigi_payload FROM orders WHERE id = ?').get(req.params.id);
    if (!order || !order.prodigi_payload) return res.json({ payload: null });
    try {
        res.json({ payload: JSON.parse(order.prodigi_payload) });
    } catch (e) {
        res.json({ payload: order.prodigi_payload });
    }
});

app.get('/api/admin/claims', requireAdmin, (req, res) => {
    const claims = db.prepare(`
        SELECT id, domain_name, claim_token, buyer_name, buyer_email, recipient_email, status, created_at, claimed_at
        FROM claims ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json({ claims });
});

app.get('/api/admin/domains', requireAdmin, (req, res) => {
    const domains = db.prepare(`
        SELECT id, domain_name, namecom_domain_id, purchase_price, purchase_years,
               registrant_name, registrant_email, status, claim_token, created_at
        FROM purchased_domains ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json({ domains });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const users = db.prepare(`
        SELECT id, username, email, registry_id, created_at FROM users ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json({ users });
});

app.get('/api/admin', requireAdmin, async (req, res) => {
    const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const claimCount = db.prepare('SELECT COUNT(*) as count FROM claims').get().count;
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const domainCount = db.prepare('SELECT COUNT(*) as count FROM purchased_domains').get().count;
    const pendingDomains = db.prepare("SELECT COUNT(*) as count FROM purchased_domains WHERE status='pending'").get().count;

    // Recent orders
    const recentOrders = db.prepare(`
        SELECT id, prodigi_order_id, recipient_name, total_paid, status, created_at 
        FROM orders ORDER BY created_at DESC LIMIT 10
    `).all();

    res.json({
        stats: { orderCount, claimCount, userCount, domainCount, pendingDomains },
        recentOrders,
    });
});

// Serve admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ===== STATIC FILES (after API routes) =====
// Vercel serves public/ from its CDN; Express serves the same directory locally.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve index-new.html as the default page (SPA routing for query-param pages)
app.get(['/', '/claim', '/order-status'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index-new.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log('\n\u2713 DOT DEED marketplace hosted locally');
    console.log(`\u2192 Open your browser: http://localhost:${PORT}`);
    console.log('\u2192 Database: dotdeed.db (SQLite)\n');
});
