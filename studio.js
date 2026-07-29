// ===== UTILITY: DEBOUNCE =====
function debounce(fn, delay = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ===== ACCOUNT SYSTEM (Backend API) =====
let currentUser = null;

async function api(url, data) {
    const options = { headers: { 'Content-Type': 'application/json' } };
    if (data) {
        options.method = 'POST';
        options.body = JSON.stringify(data);
    }
    const res = await fetch(url, options);
    return res.json();
}

function openAuthModal() {
    document.getElementById('authModalOverlay').classList.remove('hidden');
    document.getElementById('signinForm').reset();
    document.getElementById('signupForm').reset();
    document.getElementById('signinError').classList.add('hidden');
    document.getElementById('signupError').classList.add('hidden');
    switchAuthTab('signin');
    // Initialize Google sign-in button
    setTimeout(initGoogleSignIn, 300);
}

function closeAuthModal() {
    document.getElementById('authModalOverlay').classList.add('hidden');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('signinForm').classList.toggle('hidden', tab !== 'signin');
    document.getElementById('signupForm').classList.toggle('hidden', tab !== 'signup');
}

async function handleSignUp(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const errorEl = document.getElementById('signupError');

    if (!username) { showAuthError(errorEl, 'Please enter a username'); return; }
    if (!email || !email.includes('@')) { showAuthError(errorEl, 'Please enter a valid email address'); return; }
    if (password.length < 6) { showAuthError(errorEl, 'Password must be at least 6 characters'); return; }
    if (password !== confirm) { showAuthError(errorEl, 'Passwords do not match'); return; }

    const result = await api('/api/signup', { username, password, email });
    if (result.error) { showAuthError(errorEl, result.error); return; }

    currentUser = { username: result.username, registryId: result.registryId };
    updateAuthUI();
    updateRegistryIdField();
    closeAuthModal();
    // Pre-fill recipient name in studio if on that panel
    const nameField = document.getElementById('recipientName');
    const studioPanel = document.getElementById('studio');
    if (nameField && studioPanel?.classList.contains('active') && !nameField.value) {
        nameField.value = result.username;
        if (typeof updatePreview === 'function') updatePreview();
    }
    showNotification(`Account created! Your Registry ID: ${result.registryId}`);
}

async function handleSignIn(e) {
    e.preventDefault();
    const username = document.getElementById('signinUsername').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errorEl = document.getElementById('signinError');

    if (!username || !password) { showAuthError(errorEl, 'Please enter username and password'); return; }

    const result = await api('/api/signin', { username, password });
    if (result.error) { showAuthError(errorEl, result.error); return; }

    currentUser = { username: result.username, registryId: result.registryId };
    updateAuthUI();
    updateRegistryIdField();
    closeAuthModal();
    // Pre-fill recipient name in studio if on that panel
    const nameField = document.getElementById('recipientName');
    const studioPanel = document.getElementById('studio');
    if (nameField && studioPanel?.classList.contains('active') && !nameField.value) {
        nameField.value = result.username;
        if (typeof updatePreview === 'function') updatePreview();
    }
    showNotification(`Welcome back, ${result.username}!`);
}

async function handleGuestLogin() {
    const errorEl = document.getElementById('signinError');
    errorEl.classList.add('hidden');

    try {
        const result = await api('/api/guest', {});
        if (result.error) { showAuthError(errorEl, result.error); return; }

        currentUser = { username: result.username, registryId: result.registryId, isGuest: true };
        updateAuthUI();
        updateRegistryIdField();
        closeAuthModal();
        showNotification(`Logged in as ${result.username} (guest)`);
    } catch (err) {
        showAuthError(errorEl, 'Server unavailable. Make sure the server is running.');
    }
}

async function handleGoogleSignIn(response) {
    const errorEl = document.getElementById('signinError');
    errorEl.classList.add('hidden');

    try {
        const result = await api('/api/google-signin', { credential: response.credential });
        if (result.error) { showAuthError(errorEl, result.error); return; }

        currentUser = { username: result.username, registryId: result.registryId };
        updateAuthUI();
        updateRegistryIdField();
        closeAuthModal();
        
        // Decode Google profile to pre-fill name
        try {
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const googleName = payload.name || payload.given_name || '';
            const nameField = document.getElementById('recipientName');
            const studioPanel = document.getElementById('studio');
            if (googleName && nameField && studioPanel?.classList.contains('active')) {
                nameField.value = googleName;
                if (typeof updatePreview === 'function') updatePreview();
            }
        } catch (e) {
            // Silently fail - name prefill is a nice-to-have
        }
        
        showNotification(`Welcome, ${result.username}!`);
    } catch (err) {
        showAuthError(errorEl, 'Google sign-in failed. Please try again.');
    }
}

// Initialize Google Sign-In button when auth modal opens
function initGoogleSignIn() {
    const div = document.getElementById('googleSignInDiv');
    if (!div || typeof google === 'undefined' || !google.accounts) return;
    
    div.innerHTML = '';
    google.accounts.id.initialize({
        client_id: '225372944068-dinr71d04igfu2733q3f4a4bb8b25cg2.apps.googleusercontent.com',
        callback: handleGoogleSignIn
    });
    google.accounts.id.renderButton(div, {
        theme: 'outline',
        size: 'large',
        width: div.parentElement?.offsetWidth || 320,
        text: 'signin_with',
        shape: 'rect'
    });
}

function showAuthError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
}

async function logoutUser() {
    await api('/api/logout', {});
    currentUser = null;
    updateAuthUI();
    updateRegistryIdField();
    showNotification('Signed out successfully');
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const badge = document.getElementById('userRegistryBadge');
    if (currentUser && !currentUser.isGuest) {
        authBtn.textContent = 'Sign Out';
        authBtn.onclick = logoutUser;
        badge.style.display = 'flex';
        badge.querySelector('.registry-badge-id').textContent = currentUser.registryId;
        badge.title = `Logged in as ${currentUser.username} \u2022 Registry ID: ${currentUser.registryId}`;
    } else if (currentUser && currentUser.isGuest) {
        authBtn.textContent = 'Sign Out';
        authBtn.onclick = logoutUser;
        badge.style.display = 'none';
    } else {
        authBtn.textContent = 'Sign In';
        authBtn.onclick = openAuthModal;
        badge.style.display = 'none';
    }
}

function updateRegistryIdField() {
    const field = document.getElementById('registryId');
    const wrapper = field?.closest('.registry-id-wrapper');
    const hint = document.getElementById('registryIdHint');
    const guestHint = document.getElementById('registryIdGuestHint');
    
    if (currentUser && !currentUser.isGuest) {
        field.value = currentUser.registryId;
        field.readOnly = true;
        if (wrapper) wrapper.classList.add('active');
        if (hint) hint.classList.remove('hidden');
        if (guestHint) guestHint.classList.add('hidden');
    } else {
        field.value = '';
        field.readOnly = true;
        if (wrapper) wrapper.classList.remove('active');
        if (hint) hint.classList.add('hidden');
        if (guestHint) guestHint.classList.remove('hidden');
    }
    if (typeof updatePreview === 'function') updatePreview();
}

// Restore session on load
const restoreSessionPromise = (async function restoreSession() {
    try {
        const result = await api('/api/me');
        if (result.username) {
            currentUser = { username: result.username, registryId: result.registryId, email: result.email };
        }
    } catch (e) {
        // Server not running — fall back silently
        console.log('Server not available, running in offline mode');
    }
})();

// ===== STATE MANAGEMENT =====
const domainShopperCatalog = [
    // === .dev domains ===
    { name: 'quantum.dev', price: 129, description: 'A sharp, futuristic address for innovation-led brands.' },
    { name: 'pixel.dev', price: 119, description: 'Perfect for design, digital art, and creative portfolios.' },
    { name: 'forge.dev', price: 109, description: 'Built for developers crafting the next big thing.' },
    { name: 'nexus.dev', price: 139, description: 'A central hub for connected technologies and platforms.' },
    { name: 'apex.dev', price: 149, description: 'Reach the peak of performance and innovation.' },
    { name: 'cascade.dev', price: 99, description: 'Flowing, dynamic — ideal for data and pipeline tools.' },
    { name: 'ember.dev', price: 115, description: 'Warm, glowing name for front-end and UI-focused projects.' },
    { name: 'horizon.dev', price: 125, description: 'Looking ahead — perfect for roadmaps and future-tech.' },
    { name: 'lantern.dev', price: 95, description: 'Light the way with this illuminating domain.' },
    { name: 'vault.dev', price: 145, description: 'Secure, trustworthy — built for authentication and storage.' },
    { name: 'stride.dev', price: 105, description: 'Forward motion for agile teams and CI/CD platforms.' },
    { name: 'beacon.dev', price: 135, description: 'Signal your presence with this standout domain.' },

    // === .io domains ===
    { name: 'northstar.io', price: 149, description: 'Premium technology naming for ambitious product teams.' },
    { name: 'pulse.io', price: 129, description: 'Real-time data, monitoring, and live interaction platforms.' },
    { name: 'drift.io', price: 119, description: 'Smooth, effortless — ideal for streaming and messaging.' },
    { name: 'flare.io', price: 139, description: 'Burst of brilliance for CDN, security, and edge services.' },
    { name: 'morph.io', price: 109, description: 'Transformation and adaptation — perfect for AI and ML tools.' },
    { name: 'spark.io', price: 125, description: 'Ignite ideas with this energetic and modern domain.' },
    { name: 'tide.io', price: 115, description: 'Rising momentum for fintech and market platforms.' },
    { name: 'prism.io', price: 135, description: 'Multi-faceted name for analytics and visualization tools.' },
    { name: 'orbit.io', price: 145, description: 'Circular motion for community and engagement platforms.' },
    { name: 'swift.io', price: 155, description: 'Fast, reliable — built for logistics and delivery tech.' },
    { name: 'echo.io', price: 99, description: 'Resonant name for audio, podcast, and voice platforms.' },
    { name: 'grid.io', price: 119, description: 'Structured, scalable — ideal for cloud infrastructure.' },

    // === .cloud domains ===
    { name: 'signal.cloud', price: 189, description: 'Built for modern infrastructure, SaaS, and cloud operations.' },
    { name: 'drift.cloud', price: 169, description: 'Seamless cloud migration and deployment solutions.' },
    { name: 'forge.cloud', price: 179, description: 'Create and deploy with this powerful cloud-native name.' },
    { name: 'bridge.cloud', price: 159, description: 'Connecting on-premise and cloud environments.' },
    { name: 'hub.cloud', price: 149, description: 'Centralized cloud management and orchestration.' },
    { name: 'peak.cloud', price: 199, description: 'Scalable performance at the highest level.' },
    { name: 'arc.cloud', price: 175, description: 'Curved path to cloud architecture and design.' },
    { name: 'node.cloud', price: 165, description: 'Distributed systems and edge computing made simple.' },

    // === .studio domains ===
    { name: 'atelier.studio', price: 159, description: 'Stylish and memorable for creative agencies and studios.' },
    { name: 'north.studio', price: 139, description: 'Directional name for guided creative services.' },
    { name: 'rove.studio', price: 129, description: 'Wandering creativity — perfect for nomadic studios.' },
    { name: 'loom.studio', price: 149, description: 'Weave your creative vision into reality.' },
    { name: 'grove.studio', price: 119, description: 'Natural, organic name for eco-conscious brands.' },
    { name: 'cove.studio', price: 135, description: 'A safe harbor for design thinking and innovation.' },
    { name: 'dune.studio', price: 145, description: 'Shifting landscapes of modern creative work.' },
    { name: 'vale.studio', price: 125, description: 'A valley of inspiration for your creative team.' },

    // === .ventures domains ===
    { name: 'heritage.ventures', price: 179, description: 'Elegant and strategic for investment or advisory brands.' },
    { name: 'summit.ventures', price: 199, description: 'Reach the pinnacle of business and investment success.' },
    { name: 'meridian.ventures', price: 189, description: 'A peak point for venture capital and strategic growth.' },
    { name: 'pinnacle.ventures', price: 209, description: 'Top-tier name for high-stakes investment firms.' },
    { name: 'catalyst.ventures', price: 169, description: 'Accelerate growth and drive transformative change.' },

    // === .co domains ===
    { name: 'beam.co', price: 89, description: 'Shine a light on your startup or side project.' },
    { name: 'luna.co', price: 99, description: 'Celestial name for lifestyle, wellness, and design brands.' },
    { name: 'vibe.co', price: 79, description: 'Energy and atmosphere for modern lifestyle platforms.' },
    { name: 'edge.co', price: 95, description: 'Stay ahead with this sharp, competitive domain.' },
    { name: 'rise.co', price: 85, description: 'Ascend with this aspirational and uplifting domain.' },
    { name: 'flow.co', price: 75, description: 'Smooth name for wellness, productivity, and creative tools.' },

    // === .app domains ===
    { name: 'daily.app', price: 69, description: 'Everyday utility and habit-tracking applications.' },
    { name: 'quick.app', price: 59, description: 'Fast, lightweight tools for instant productivity.' },
    { name: 'round.app', price: 65, description: 'Community-driven apps for social good and connection.' },
    { name: 'plain.app', price: 55, description: 'Minimalist, no-fuss applications that just work.' },
    { name: 'tally.app', price: 75, description: 'Counting, tracking, and data collection made elegant.' },
    { name: 'glow.app', price: 79, description: 'Radiant design for beauty, wellness, and lifestyle apps.' },

    // === .ai domains ===
    { name: 'cortex.ai', price: 249, description: 'Deep learning and neural network innovation hub.' },
    { name: 'logic.ai', price: 229, description: 'Reasoning engines and symbolic AI platforms.' },
    { name: 'neural.ai', price: 269, description: 'Cutting-edge AI research and deployment.' },
    { name: 'synapse.ai', price: 239, description: 'Connecting AI models and data pipelines.' },
    { name: 'vector.ai', price: 219, description: 'Embedding and vector database solutions.' },
    { name: 'tensor.ai', price: 259, description: 'Tensor operations and machine learning frameworks.' },
    { name: 'droid.ai', price: 199, description: 'Robotics and autonomous systems development.' },
    { name: 'learn.ai', price: 189, description: 'AI education, training, and skill development.' },

    // === .tech domains ===
    { name: 'zeta.tech', price: 109, description: 'Sixth-generation technology and beyond.' },
    { name: 'nova.tech', price: 119, description: 'Explosive innovation for emerging tech companies.' },
    { name: 'terra.tech', price: 99, description: 'Grounded technology for real-world applications.' },
    { name: 'ultra.tech', price: 129, description: 'High-performance computing and premium hardware.' },
    { name: 'fiber.tech', price: 105, description: 'Connectivity, networking, and telecommunications.' },

    // === .design domains ===
    { name: 'craft.design', price: 89, description: 'Artisanal approach to modern design systems.' },
    { name: 'pure.design', price: 95, description: 'Clean, minimalist design for discerning brands.' },
    { name: 'bold.design', price: 79, description: 'Make a statement with confident visual design.' },
    { name: 'linear.design', price: 85, description: 'Structured, systematic design methodologies.' },
    { name: 'polar.design', price: 75, description: 'Crisp, clean design with a cool aesthetic.' },

    // === .life domains ===
    { name: 'bloom.life', price: 69, description: 'Personal growth, wellness, and flourishing communities.' },
    { name: 'tide.life', price: 59, description: 'Rhythm and flow for lifestyle and mindfulness brands.' },
    { name: 'root.life', price: 65, description: 'Grounded living, sustainability, and organic growth.' },
    { name: 'glow.life', price: 75, description: 'Radiant health, beauty, and inner wellness.' },
    { name: 'clarity.life', price: 79, description: 'Mental clarity, focus, and mindful living.' },

    // === .xyz domains (budget friendly) ===
    { name: 'void.xyz', price: 29, description: 'Minimalist, mysterious — for experimental projects.' },
    { name: 'flux.xyz', price: 35, description: 'Constant change and adaptation for dynamic teams.' },
    { name: 'echo.xyz', price: 25, description: 'Affordable domain for side projects and prototypes.' },
    { name: 'brick.xyz', price: 39, description: 'Build from the ground up with this solid domain.' },
    { name: 'fuse.xyz', price: 33, description: 'Connect ideas and technologies with explosive results.' },

    // === Premium short domains ===
    { name: 'meta.io', price: 299, description: 'Premium short domain for metaverse and Web3 platforms.' },
    { name: 'apex.app', price: 149, description: 'Top-tier app development and premium mobile presence.' },
    { name: 'zinc.co', price: 159, description: 'Essential, durable — a foundation for any brand.' },
    { name: 'onyx.dev', price: 249, description: 'Rare and precious — for exclusive developer tools.' },
    { name: 'jade.cloud', price: 279, description: 'Smooth, valuable — premium cloud infrastructure name.' },
];

function getTierCapabilities(tier) {
    const normalized = String(tier || 'Essential').toLowerCase();

    if (normalized === 'elite') {
        return {
            canChangeFont: true,
            canChangePrimaryColor: true,
            canChangeSecondaryColor: true,
            canChangeBorderStyle: true,
            canChangeSealStyle: true,
            canChangePaperTexture: true,
            canChangeAwardTitle: true,
            canUseGoldFoil: true,
            canChangeCornerOrnament: true,
            canChangeFiligree: true
        };
    }

    if (normalized === 'premium') {
        return {
            canChangeFont: true,
            canChangePrimaryColor: true,
            canChangeSecondaryColor: true,
            canChangeBorderStyle: false,
            canChangeSealStyle: true,
            canChangePaperTexture: true,
            canChangeAwardTitle: true,
            canUseGoldFoil: false,
            canChangeCornerOrnament: true,
            canChangeFiligree: false
        };
    }

    return {
        canChangeFont: true,
        canChangePrimaryColor: true,
        canChangeSecondaryColor: false,
        canChangeBorderStyle: false,
        canChangeSealStyle: false,
        canChangePaperTexture: true,
        canChangeAwardTitle: false,
        canUseGoldFoil: false,
        canChangeCornerOrnament: false,
        canChangeFiligree: false
    };
}

let currentCertificate = {
    type: 'Essential',
    recipientName: '',
    domainName: '',
    domainPrice: 0,
    registryId: '',
    issueDate: new Date().toISOString().split('T')[0],
    customizationEnabled: false,
    customizationNotes: '',
    domainYears: 1,
    claimToken: null,
    claimUrl: null,
};
// ===== PRICING =====
// 10% margin applied to print + shipping + alterations
const MARGIN_PERCENT = 0.10;

function getDomainPrice(domainName) {
    if (!domainName || domainName === '[domain.com]') return 0;
    // Check live results first
    if (liveDomainResults.length > 0) {
        const live = liveDomainResults.find(d => d.name === domainName);
        if (live) return live.price;
    }
    // Fallback to catalog
    const domain = domainShopperCatalog.find(d => d.name === domainName);
    return domain ? domain.price : 0;
}

// ===== DOMAIN SEARCH (API + Fallback) =====
let liveDomainResults = [];
let searchTimeout = null;

async function searchDomainsApi(query) {
    try {
        const res = await fetch(`/api/search-domains?keyword=${encodeURIComponent(query)}&limit=30`);
        const data = await res.json();
        if (data.domains && data.domains.length > 0) {
            liveDomainResults = data.domains.map(d => ({
                name: d.name,
                price: d.price > 0 ? d.price : 0,
                description: d.available ? 'Available for registration' : 'Taken',
                available: d.available === true,
                premium: d.premium === true || d.price >= 200,
                tld: d.tld || '.' + d.name.split('.').pop(),
            }));
        }
    } catch (e) {}
}

// ===== DARK MODE =====
function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const stored = localStorage.getItem('dotdeed-theme');
    
    // Apply stored preference; default to light
    if (stored === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
    
    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('dotdeed-theme', next);
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize dark mode
    initDarkMode();
    
    // Set today's date as default
    document.getElementById('issueDate').value = new Date().toISOString().split('T')[0];
    
    // Set up navigation
    setupNavigation();
    
    // Set up debounced preview listeners
    setupPreviewListeners();
    
    // Wait for session restore (from API) then update UI
    await restoreSessionPromise;
    updateAuthUI();
    updateRegistryIdField();
    
    // Initial preview render (hidden)
    renderDomainShopper();
    updatePreview();
});

// ===== NAVIGATION =====
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');
            navigateToPanel(target);
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function navigateToPanel(panelId) {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    const targetPanel = document.querySelector(panelId);
    if (targetPanel) {
        targetPanel.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ===== DEBOUNCED PREVIEW LISTENERS =====
function setupPreviewListeners() {
    const debouncedPreview = debounce(() => {
        updatePreview();
        queueBackgroundRender();
    });
    
    const previewInputs = [
        'recipientName', 'domainName', 'issueDate', 'certificateUpgrade',
        'upgradeNotes', 'fontStyle', 'primaryColor', 'secondaryColor',
        'borderStyle', 'sealStyle', 'paperTexture', 'awardTitle',
        'cornerOrnamentStyle', 'filigreePattern', 'goldFoilAccent',
        'frameUpgrade', 'frameWoodType', 'scrollOption', 'displayOption'
    ];

    previewInputs.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventType = el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'date'
            ? 'input' : 'change';
        // Radio buttons need 'change' event, but we handle displayOption via click
        if (id === 'displayOption') return;
        el.addEventListener(eventType, debouncedPreview);
    });

    // Orientation radio buttons
    document.querySelectorAll('input[name="certOrientation"]').forEach(radio => {
        radio.addEventListener('change', debouncedPreview);
    });

    // Orientation toggle styling
    document.querySelectorAll('.orient-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.orient-btn').forEach(b => {
                b.style.borderColor = 'var(--border-light)';
                b.style.background = 'var(--bg-primary)';
                b.style.color = 'var(--text-secondary)';
            });
            this.style.borderColor = 'var(--deep-maroon)';
            this.style.background = 'rgba(107,11,34,0.06)';
            this.style.color = 'var(--deep-maroon)';
            const radio = this.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Display option: frame vs scroll (radio buttons)
    function switchDisplayOption(option) {
        document.querySelectorAll('.display-option').forEach(el => {
            el.style.borderColor = 'var(--border-light)';
            el.style.background = 'var(--bg-primary)';
            el.style.color = 'var(--text-secondary)';
        });
        const label = document.getElementById(option + 'Label');
        if (label) {
            label.style.borderColor = 'var(--deep-maroon)';
            label.style.background = 'rgba(107,11,34,0.06)';
            label.style.color = 'var(--deep-maroon)';
        }
        const hint = document.getElementById('displayHint');
        if (hint) {
            hint.textContent = option === 'frame' 
                ? '8\u00d710" classic frame, matted, perspex glazing \u2014 ready to hang.'
                : 'Fine art print on 200gsm matte paper, shipped in protective tube.';
        }
        updatePreview();
        queueBackgroundRender();
    }
    window.switchDisplayOption = switchDisplayOption;

    // Country change → re-fetch Prodigi quote
    const billingCountry = document.getElementById('billingCountry');
    if (billingCountry) {
        billingCountry.addEventListener('change', onBillingCountryChange);
    }
}

function updateNavActive(hash) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(l => l.classList.remove('active'));
    const matchingLink = document.querySelector(`.nav-link[href="${hash}"]`);
    if (matchingLink) matchingLink.classList.add('active');
}

// ===== STOREFRONT INTERACTIONS =====
function openStudio(cardElement, type) {
    currentCertificate.type = type;
    
    // Update studio title
    document.getElementById('studioTitle').textContent = `Customize ${type} Certificate`;
    
    // Sync tier pills
    document.querySelectorAll('.studio-tier-pill').forEach(p => p.classList.remove('active'));
    const activePill = document.querySelector(`.studio-tier-pill[data-tier="${type}"]`);
    if (activePill) activePill.classList.add('active');
    
    // Reset gift mode to self
    if (isGiftMode) setGiftMode(false);
    
    // Clear form inputs
    document.getElementById('recipientName').value = '';
    document.getElementById('issueDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('certificateUpgrade').checked = false;
    document.getElementById('upgradeNotes').value = '';
    document.getElementById('frameWoodType').value = 'black';
    // Set display option based on tier
    const defaultDisplay = currentCertificate.type === 'Essential' ? 'scroll' : 'frame';
    const radio = document.querySelector(`input[name="displayOption"][value="${defaultDisplay}"]`);
    if (radio) { radio.checked = true; switchDisplayOption(defaultDisplay); }
    document.getElementById('sealStyle').value = 'classic';
    document.getElementById('paperTexture').value = 'smooth';
    document.getElementById('awardTitle').value = '';
    document.getElementById('goldFoilAccent').checked = false;
    document.getElementById('cornerOrnamentStyle').value = 'classic';
    document.getElementById('filigreePattern').value = 'none';
    document.getElementById('upgradeNotesSection').classList.add('hidden');
    
    // Auto-fill domain if preselected from Domain Shopper
    const domainInput = document.getElementById('domainName');
    if (currentCertificate.preselectedDomain) {
        domainInput.value = currentCertificate.preselectedDomain;
        currentCertificate.domainName = currentCertificate.preselectedDomain;
        delete currentCertificate.preselectedDomain;
    } else {
        domainInput.value = '';
    }
    
    // Navigate to studio
    navigateToPanel('#studio');
    
    // Update nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector('a[href="#studio"]').classList.add('active');
    
    // Trigger initial preview
    updatePreview();
    queueBackgroundRender();
}

function closeStudio() {
    navigateToPanel('#storefront');
    
    // Update nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector('a[href="#storefront"]').classList.add('active');
}

// ===== STUDIO TIER & GIFT TOGGLE =====
let isGiftMode = false;

function changeTier(tier) {
    currentCertificate.type = tier;
    
    // Update pills
    document.querySelectorAll('.studio-tier-pill').forEach(p => p.classList.remove('active'));
    const activePill = document.querySelector(`.studio-tier-pill[data-tier="${tier}"]`);
    if (activePill) activePill.classList.add('active');
    
    // Update title
    document.getElementById('studioTitle').textContent = `Customize ${tier} Certificate`;
    
    // Reset customization checkbox
    document.getElementById('certificateUpgrade').checked = false;
    document.getElementById('upgradeNotesSection').classList.add('hidden');
    
    // Reset to Framed (or Scroll for Essential)
    const defaultDisplay = currentCertificate.type === 'Essential' ? 'scroll' : 'frame';
    const radio = document.querySelector(`input[name="displayOption"][value="${defaultDisplay}"]`);
    if (radio) { radio.checked = true; switchDisplayOption(defaultDisplay); }
    
    
    updatePreview();
}

function setGiftMode(isGift) {
    isGiftMode = isGift;
    
    // Update toggle buttons
    document.getElementById('giftToggleSelf').classList.toggle('active', !isGift);
    document.getElementById('giftToggleGift').classList.toggle('active', isGift);
    
    // Update labels and placeholders
    const label = document.getElementById('recipientLabel');
    const hint = document.getElementById('recipientHint');
    const input = document.getElementById('recipientName');
    const title = document.getElementById('studioDetailsTitle');
    
    if (isGift) {
        label.textContent = "Recipient's Name";
        input.placeholder = "Enter the recipient's full name";
        hint.textContent = 'The person receiving this gift certificate';
        title.textContent = 'Gift Details';
    } else {
        label.textContent = 'Your Name';
        input.placeholder = 'Enter your full name';
        hint.textContent = 'Will appear as the certificate holder';
        title.textContent = 'Your Details';
    }
}

function renderDomainShopper() {
    // Empty initial state — user must search
    showEmptyState();
    const countEl = document.getElementById('domainResultCount');
    if (countEl) countEl.textContent = '0';
}

function showEmptyState() {
    const container = document.getElementById('domainShopperGrid');
    if (!container) return;
    container.innerHTML = `
        <div class="nc-empty-state">
            <div class="nc-empty-state-icon" style="font-size:2.5rem;">🔍</div>
            <h3>Search for a domain</h3>
            <p>Type a name above to see available domains across all TLDs.</p>
            <div class="nc-popular-tlds" style="justify-content:center;margin-top:1rem;gap:0.5rem;">
                <span style="font-size:0.8rem;color:var(--text-secondary);">Popular:</span>
                <span style="padding:0.2rem 0.5rem;border:1px solid rgba(107,11,34,0.2);border-radius:4px;font-size:0.75rem;color:var(--deep-maroon);">.com</span>
                <span style="padding:0.2rem 0.5rem;border:1px solid rgba(107,11,34,0.2);border-radius:4px;font-size:0.75rem;color:var(--deep-maroon);">.io</span>
                <span style="padding:0.2rem 0.5rem;border:1px solid rgba(107,11,34,0.2);border-radius:4px;font-size:0.75rem;color:var(--deep-maroon);">.dev</span>
                <span style="padding:0.2rem 0.5rem;border:1px solid rgba(107,11,34,0.2);border-radius:4px;font-size:0.75rem;color:var(--deep-maroon);">.app</span>
                <span style="padding:0.2rem 0.5rem;border:1px solid rgba(107,11,34,0.2);border-radius:4px;font-size:0.75rem;color:var(--deep-maroon);">.ai</span>
            </div>
        </div>`;
}

let searchPerformed = false;
let activeTldFilter = 'all';
let activePriceRange = 'all';
let activeSort = 'default';
let availableOnly = false;

function filterByTLD(tld) {
    activeTldFilter = tld;
    document.querySelectorAll('.tld-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tld === tld);
    });
    if (searchPerformed) {
        const input = document.getElementById('domainSearchInput');
        renderFilteredDomains(input.value);
    }
}

function filterByPriceRange(range) {
    activePriceRange = range;
    document.querySelectorAll('.price-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });
    if (searchPerformed) {
        const input = document.getElementById('domainSearchInput');
        renderFilteredDomains(input.value);
    }
}

function applySort() {
    activeSort = document.getElementById('sortSelect').value;
    if (searchPerformed) {
        const input = document.getElementById('domainSearchInput');
        renderFilteredDomains(input.value);
    }
}

function toggleAvailableOnly() {
    availableOnly = document.getElementById('availableOnly').checked;
    if (searchPerformed) {
        const input = document.getElementById('domainSearchInput');
        renderFilteredDomains(input.value);
    }
}

function renderFilteredDomains(filter) {
    const container = document.getElementById('domainShopperGrid');
    if (!container) return;

    const query = (filter || '').toLowerCase().trim();
    const tldFilter = activeTldFilter === 'all' ? null : activeTldFilter;

    // Use live API results
    let source = liveDomainResults.length > 0 ? liveDomainResults : domainShopperCatalog;

    let filtered = source.filter(d => {
        const domainTld = '.' + d.name.split('.').pop();

        // TLD filter
        if (tldFilter && domainTld !== tldFilter) return false;

        // Price range filter
        if (activePriceRange !== 'all') {
            if (activePriceRange === 'under50' && d.price >= 50) return false;
            if (activePriceRange === '50to150' && (d.price < 50 || d.price > 150)) return false;
            if (activePriceRange === '150to250' && (d.price < 150 || d.price > 250)) return false;
            if (activePriceRange === 'over250' && d.price <= 250) return false;
        }

        // Available only filter
        if (availableOnly) {
            const avail = d.available !== undefined ? d.available : getDomainAvailability(d.name);
            if (!avail) return false;
        }

        // Search query
        if (query) {
            return d.name.toLowerCase().includes(query) ||
                   (d.description || '').toLowerCase().includes(query) ||
                   domainTld.toLowerCase().includes(query) ||
                   d.price.toString().includes(query);
        }
        return true;
    });

    // Apply sorting
    if (activeSort !== 'default') {
        filtered = [...filtered].sort((a, b) => {
            switch (activeSort) {
                case 'price-asc': return a.price - b.price;
                case 'price-desc': return b.price - a.price;
                case 'name-asc': return a.name.localeCompare(b.name);
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'tld': {
                    const tldA = a.name.split('.').pop();
                    const tldB = b.name.split('.').pop();
                    if (tldA !== tldB) return tldA.localeCompare(tldB);
                    return a.name.localeCompare(b.name);
                }
                default: return 0;
            }
        });
    }

    // Update result count
    const countEl = document.getElementById('domainResultCount');
    if (countEl) countEl.textContent = filtered.length;
    
    // Update search query label
    const queryLabel = document.getElementById('domainSearchQuery');
    if (queryLabel) {
        queryLabel.textContent = query || '';
        queryLabel.style.display = query ? 'inline' : 'none';
    }

    if (filtered.length === 0) {
        container.innerHTML = query ? `
            <div class="nc-empty-state">
                <div class="nc-empty-state-icon">😕</div>
                <h3>${escapeHtml(query)} is not available</h3>
                <p>We couldn't find any available domains matching "${escapeHtml(query)}". Try a different spelling or keyword.</p>
            </div>` : `
            <div class="nc-empty-state">
                <div class="nc-empty-state-icon">🔍</div>
                <h3>No domains found</h3>
                <p>Try adjusting your filters or <a href="#" onclick="resetAllFilters(); return false;">reset all filters</a>.</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(domain => {
        const tld = '.' + domain.name.split('.').pop();
        const isPremium = domain.premium || domain.price >= 200;
        const isBudget = domain.price <= 50;
        const available = domain.available !== undefined ? domain.available : getDomainAvailability(domain.name);
        
        return `
        <div class="nc-result-row ${available ? 'available' : 'taken'}">
            <div class="nc-result-domain">
                <span class="nc-domain-name">${escapeHtml(domain.name)}</span>
                <span class="nc-domain-tld">${tld}</span>
            </div>
            <div class="nc-result-meta">
                ${isPremium ? '<span class="nc-badge nc-badge-premium">Premium</span>' : ''}
                ${isBudget ? '<span class="nc-badge nc-badge-value">Value</span>' : ''}
                <span class="nc-avail-tag ${available ? 'avail' : 'taken'}">${available ? 'Available' : 'Taken'}</span>
            </div>
            <div class="nc-result-price">
                ${domain.price > 0 ? `<span class="nc-price">$${Math.round(domain.price)}</span><span class="nc-price-period">/yr</span>` : (available ? `<span class="nc-price-period">Price N/A</span>` : ``)}
            </div>
            <div class="nc-result-action">
                ${available 
                    ? `<button class="nc-select-btn" onclick="selectDomainForCertificate('${domain.name}')">Select</button>`
                    : `<span class="nc-unavailable" style="font-size:0.75rem;color:var(--text-secondary);">Try another TLD</span>`}
            </div>
        </div>`;
    }).join('');
}

function filterDomains() {
    const input = document.getElementById('domainSearchInput');
    const query = input.value.trim();
    
    if (!query) {
        searchPerformed = false;
        showEmptyState();
        const countEl = document.getElementById('domainResultCount');
        if (countEl) countEl.textContent = '0';
        document.getElementById('searchClearBtn').style.display = 'none';
        return;
    }
    
    document.getElementById('searchClearBtn').style.display = 'flex';
    
    // Show loading
    const container = document.getElementById('domainShopperGrid');
    if (container) {
        container.innerHTML = `<div class="nc-empty-state"><div class="nc-empty-state-icon" style="animation:spin 0.8s linear infinite;">🔍</div><h3>Searching for ${escapeHtml(query)}...</h3></div>`;
    }
    
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        await searchDomainsApi(query);
        searchPerformed = true;
        renderFilteredDomains(query);
    }, 300);
}

function clearDomainSearch() {
    const input = document.getElementById('domainSearchInput');
    input.value = '';
    document.getElementById('searchClearBtn').style.display = 'none';
    renderFilteredDomains('');
    input.focus();
}

function resetAllFilters() {
    // Reset search
    document.getElementById('domainSearchInput').value = '';
    document.getElementById('searchClearBtn').style.display = 'none';

    // Reset TLD
    activeTldFilter = 'all';
    document.querySelectorAll('.tld-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tld === 'all');
    });

    // Reset price range
    activePriceRange = 'all';
    document.querySelectorAll('.price-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === 'all');
    });

    // Reset sort
    activeSort = 'default';
    document.getElementById('sortSelect').value = 'default';

    // Reset available only
    availableOnly = false;
    document.getElementById('availableOnly').checked = false;

    searchPerformed = false;
    showEmptyState();
    const countEl = document.getElementById('domainResultCount');
    if (countEl) countEl.textContent = '0';
    document.getElementById('domainSearchInput').focus();
}

// Simulate domain availability (80% chance available)
function getDomainAvailability(domainName) {
    // Check live API results first
    const live = liveDomainResults.find(d => d.name === domainName);
    if (live) return live.available;
    // Fallback: check static catalog
    const catalog = domainShopperCatalog.find(d => d.name === domainName);
    if (catalog && catalog.available !== undefined) return catalog.available;
    // Default to unavailable if we don't know
    return false;
}

// Color palette for TLD tags
function getTldColor(tld) {
    const colors = {
        '.dev': '#3b82f6',
        '.io': '#8b5cf6',
        '.cloud': '#06b6d4',
        '.studio': '#f59e0b',
        '.ventures': '#10b981',
        '.co': '#ec4899',
        '.app': '#6366f1',
        '.ai': '#ef4444',
        '.tech': '#14b8a6',
        '.design': '#f97316',
        '.life': '#22c55e',
        '.xyz': '#6b7280'
    };
    return colors[tld] || '#6b7280';
}

function selectDomainForCertificate(domainName) {
    // Store the selected domain
    currentCertificate.domainName = domainName;
    currentCertificate.preselectedDomain = domainName;
    currentCertificate.domainPrice = getDomainPrice(domainName);
    
    // Show notification
    showNotification(`Domain ${domainName} selected! Choose your certificate tier.`);
    
    // Navigate to tier selection
    navigateToTierSelect();
}

function navigateToTierSelect(preselectedTier) {
    // Update displayed domain
    const domainEl = document.getElementById('tierDisplayDomain');
    if (domainEl) {
        domainEl.textContent = currentCertificate.preselectedDomain || currentCertificate.domainName || '—';
    }
    navigateToPanel('#tier-select');
    updateNavActive('#tier-select');
}

function selectTier(tier) {
    currentCertificate.type = tier;
    currentCertificate.preselectedDomain = currentCertificate.preselectedDomain || currentCertificate.domainName;
    
    // Navigate to studio
    openStudio(null, tier);
}

function getDisplayOption() {
    return (document.querySelector('input[name="displayOption"]:checked')?.value || 'frame');
}
function hasFramedOption() { return getDisplayOption() === 'frame'; }
function hasScrollOption() { return getDisplayOption() === 'scroll'; }

// ===== LIVE PREVIEW ENGINE =====
function updatePreview() {
    currentCertificate.recipientName = document.getElementById('recipientName').value || '[Your Name]';
    currentCertificate.domainName = document.getElementById('domainName').value || '[domain.com]';
    currentCertificate.domainPrice = getDomainPrice(currentCertificate.domainName);
    currentCertificate.registryId = document.getElementById('registryId').value || fallbackRegistryId();
    currentCertificate.issueDate = document.getElementById('issueDate').value || new Date().toISOString().split('T')[0];
    currentCertificate.customizationEnabled = document.getElementById('certificateUpgrade').checked;
    currentCertificate.customizationNotes = document.getElementById('upgradeNotes').value || '';

    // Apply tier-based add-on visibility
    const tier = currentCertificate.type;
    const isEssential = tier === 'Essential';
    const frameUpgradeSection = document.getElementById('frameUpgradeSection');
    const certUpgradeSection = document.getElementById('certificateUpgradeSection');
    if (frameUpgradeSection) frameUpgradeSection.classList.toggle('hidden', isEssential);
    if (certUpgradeSection) certUpgradeSection.classList.toggle('hidden', isEssential);
    if (isEssential) {
        document.getElementById('certificateUpgrade').checked = false;
        // Force scroll display for Essential
        const scrollRadio = document.querySelector('input[name="displayOption"][value="scroll"]');
        if (scrollRadio && !scrollRadio.checked) {
            scrollRadio.checked = true;
            switchDisplayOption('scroll');
        }
    }

    const upgradeNotesSection = document.getElementById('upgradeNotesSection');
    if (upgradeNotesSection) {
        upgradeNotesSection.classList.toggle('hidden', !currentCertificate.customizationEnabled);
    }

    const tierCustomizationSection = document.getElementById('tierCustomizationSection');
    const frameOptionsSection = document.getElementById('frameOptionsSection');
    const capabilities = getTierCapabilities(currentCertificate.type);
    if (tierCustomizationSection) {
        tierCustomizationSection.classList.toggle('hidden', !(currentCertificate.customizationEnabled && capabilities.canChangeFont));
    }
    if (frameOptionsSection) {
        frameOptionsSection.classList.toggle('hidden', !hasFramedOption());
    }

    const certHTML = renderCertificate(currentCertificate);
    const displayOption = getDisplayOption();
    const hasFrame = displayOption === 'frame';
    const hasScroll = displayOption === 'scroll';
    const frameWoodType = document.getElementById('frameWoodType')?.value || 'black';
    
    const innerContainer = document.getElementById('certCanvasInner');
    if (innerContainer) {
        if (hasScroll) {
            innerContainer.innerHTML = certHTML;
        } else {
            innerContainer.innerHTML = `
                <div class="frame-outer">
                    <div class="frame-wood" data-wood="${frameWoodType}">
                        <div class="mat-board">
                            <div class="certificate-in-frame">
                                ${certHTML}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
}

function renderCertificate(cert) {
    const formattedDate = formatDate(cert.issueDate);
    const capabilities = getTierCapabilities(cert.type);
    const customizationEnabled = cert.customizationEnabled;
    
    const fontFamily = customizationEnabled && capabilities.canChangeFont 
        ? (document.getElementById('fontStyle')?.value || 'Cormorant Garamond') : 'Cormorant Garamond';
    const primaryColor = customizationEnabled && capabilities.canChangePrimaryColor 
        ? (document.getElementById('primaryColor')?.value || '#6B0B22') : '#6B0B22';
    const secondaryColor = customizationEnabled && capabilities.canChangeSecondaryColor 
        ? (document.getElementById('secondaryColor')?.value || '#D62828') : '#D62828';
    const borderStyle = customizationEnabled && capabilities.canChangeBorderStyle 
        ? (document.getElementById('borderStyle')?.value || 'classic') : 'classic';
    const sealStyle = customizationEnabled && capabilities.canChangeSealStyle 
        ? (document.getElementById('sealStyle')?.value || 'classic') : 'classic';
    const paperTexture = customizationEnabled && capabilities.canChangePaperTexture 
        ? (document.getElementById('paperTexture')?.value || 'smooth') : 'smooth';
    const awardTitle = customizationEnabled && capabilities.canChangeAwardTitle 
        ? (document.getElementById('awardTitle')?.value || 'Digital Domain Holder') : 'Digital Domain Holder';
    const goldFoil = customizationEnabled && capabilities.canUseGoldFoil 
        ? (document.getElementById('goldFoilAccent')?.checked || false) : false;
    const cornerOrnament = customizationEnabled && capabilities.canChangeCornerOrnament 
        ? (document.getElementById('cornerOrnamentStyle')?.value || 'classic') : 'classic';
    
    const goldClass = goldFoil ? 'gold-foil' : '';
    const isLandscape = document.querySelector('input[name="certOrientation"]:checked')?.value === 'landscape';
    const orientClass = isLandscape ? 'cert-landscape' : '';
    const borderMap = { double: 'cert-border-double', ornate: 'cert-border-ornate' };
    const borderClass = borderMap[borderStyle] || 'cert-border-classic';
    const paperClass = 'paper-' + paperTexture;
    
    const cornerEl = cornerOrnament === 'victorian' ? '&#10086;' : cornerOrnament === 'artdeco' ? '&#9670;' : '';
    const cornerMarkup = cornerEl ? `
        <div class="corner-ornament corner-ornament-tl" style="color:${primaryColor}20;font-size:1.8rem;">${cornerEl}</div>
        <div class="corner-ornament corner-ornament-tr" style="color:${primaryColor}20;font-size:1.8rem;">${cornerEl}</div>
        <div class="corner-ornament corner-ornament-bl" style="color:${primaryColor}20;font-size:1.8rem;">${cornerEl}</div>
        <div class="corner-ornament corner-ornament-br" style="color:${primaryColor}20;font-size:1.8rem;">${cornerEl}</div>
    ` : `
        <div class="corner corner-tl" style="border-color:${primaryColor}30;"></div>
        <div class="corner corner-tr" style="border-color:${primaryColor}30;"></div>
        <div class="corner corner-bl" style="border-color:${primaryColor}30;"></div>
        <div class="corner corner-br" style="border-color:${primaryColor}30;"></div>`;

    const sealSvg = sealStyle === 'shield' ? `
        <svg viewBox="0 0 100 100" style="width:65px;height:65px;">
            <path d="M50 5 L90 25 L90 65 Q90 90 50 105 Q10 90 10 65 L10 25 Z" fill="${primaryColor}08" stroke="${primaryColor}" stroke-width="1.5"/>
            <text x="50" y="55" text-anchor="middle" font-size="14" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
        </svg>` : `
        <svg viewBox="0 0 100 100" style="width:65px;height:65px;">
            <circle cx="50" cy="50" r="46" fill="${primaryColor}08" stroke="${primaryColor}" stroke-width="1.5"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke="${secondaryColor}" stroke-width="1" stroke-dasharray="3 3"/>
            <path d="M35 50 L50 35 L65 50 L50 65 Z" fill="${primaryColor}18" stroke="${primaryColor}" stroke-width="1.2"/>
            <text x="50" y="54" text-anchor="middle" font-size="11" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
        </svg>`;

    const domainInfo = cert.domainName && cert.domainName !== '[domain.com]' ? cert.domainName.toLowerCase() : '';
    const domainYearsText = cert.domainPrice > 0 ? ` \u00b7 ${cert.domainYears} ${cert.domainYears === 1 ? 'year' : 'years'}` : '';
    
    // Smart text scaling based on name/title length
    const nameLen = (cert.recipientName || '').length;
    const nameSize = nameLen > 30 ? '0.9rem' : nameLen > 20 ? '1.05rem' : '1.2rem';
    const awardLen = (awardTitle || '').length;
    const awardSize = awardLen > 35 ? '0.6rem' : awardLen > 25 ? '0.7rem' : '0.8rem';
    const notesLen = (cert.customizationNotes || '').length;
    const notesSize = notesLen > 80 ? '0.42rem' : '0.5rem';

    return `
    <div class="certificate-wrapper ${borderClass} ${paperClass} ${goldClass} ${orientClass}">
        <div class="certificate-inner" style="font-family:'${fontFamily}',Georgia,serif;">
            ${cornerMarkup}
            
            <div style="height:3px;background:linear-gradient(90deg,transparent,${primaryColor},${secondaryColor},${primaryColor},transparent);margin:0 0 0.5rem;"></div>
            
            <div style="text-align:center;margin-bottom:0.3rem;">
                <div style="font-size:1rem;font-weight:700;letter-spacing:3px;color:${primaryColor};">DOT DEED</div>
                <div style="font-size:0.5rem;color:${secondaryColor};letter-spacing:2px;text-transform:uppercase;">Registry of Digital Estates</div>
            </div>
            
            <div style="text-align:center;font-size:0.45rem;color:${primaryColor}60;letter-spacing:2px;margin-bottom:0.4rem;font-style:italic;">Veritas \u00b7 Digitalis \u00b7 Honor</div>
            
            <div style="display:flex;align-items:center;gap:0.5rem;margin:0 1rem 0.5rem;">
                <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,${primaryColor}40);"></div>
                <span style="color:${primaryColor}60;font-size:0.55rem;">&#9884;</span>
                <div style="flex:1;height:1px;background:linear-gradient(90deg,${primaryColor}40,transparent);"></div>
            </div>
            
            <div style="text-align:center;font-size:0.5rem;color:${primaryColor}99;letter-spacing:1px;margin-bottom:0.25rem;">By the authority vested in the Registry, it is hereby certified that</div>
            
            <div style="text-align:center;font-size:${nameSize};font-weight:700;color:${primaryColor};margin-bottom:0.2rem;letter-spacing:1px;font-family:'${fontFamily}',Georgia,serif;">
                ${escapeHtml(cert.recipientName)}
            </div>
            
            <div style="text-align:center;font-size:0.45rem;color:${primaryColor}88;letter-spacing:1px;margin-bottom:0.25rem;">having demonstrated rightful stewardship, is granted the title of</div>
            
            <div style="text-align:center;margin:0.2rem 2rem;padding:0.2rem 0;border-top:1px solid ${primaryColor}30;border-bottom:1px solid ${primaryColor}30;">
                <span style="font-size:${awardSize};font-weight:700;color:${primaryColor};letter-spacing:1px;">${escapeHtml(awardTitle)}</span>
            </div>
            
            ${domainInfo ? `
            <div style="text-align:center;margin:0.4rem 0 0.2rem;">
                <div style="font-size:0.45rem;color:${primaryColor}88;letter-spacing:1px;margin-bottom:0.1rem;">Network Namespace</div>
                <div style="display:inline-block;padding:0.12rem 1rem;background:${primaryColor};color:#fff;font-size:0.7rem;font-weight:600;letter-spacing:0.5px;border-radius:2px;">${domainInfo}</div>
                ${domainYearsText ? `<div style="font-size:0.4rem;color:${primaryColor}66;margin-top:0.08rem;">Registered for${domainYearsText}</div>` : ''}
            </div>` : ''}
            
            ${customizationEnabled && cert.customizationNotes ? `
            <div style="text-align:center;font-size:${notesSize};color:${primaryColor}99;font-style:italic;margin:0.15rem 1.5rem;line-height:1.4;">${escapeHtml(cert.customizationNotes)}</div>` : ''}
            
            <div style="display:flex;align-items:center;justify-content:center;gap:1rem;margin:0.4rem 0 0.25rem;">
                <div style="text-align:center;flex:1;max-width:90px;">
                    <div style="height:1px;background:${primaryColor};margin-bottom:0.12rem;"></div>
                    <div style="font-size:0.45rem;color:${primaryColor};font-weight:600;letter-spacing:1px;">Registrar</div>
                    <div style="font-size:0.38rem;color:${primaryColor}88;">Officer of the Registry</div>
                </div>
                <div style="flex:0 0 auto;">${sealSvg}</div>
                <div style="text-align:center;flex:1;max-width:90px;">
                    <div style="height:1px;background:${primaryColor};margin-bottom:0.12rem;"></div>
                    <div style="font-size:0.45rem;color:${primaryColor};font-weight:600;letter-spacing:1px;">Chancellor</div>
                    <div style="font-size:0.38rem;color:${primaryColor}88;">Dean of Digital Estates</div>
                </div>
            </div>
            
            <div style="height:1px;background:linear-gradient(90deg,transparent,${primaryColor}30,transparent);margin:0 1rem 0.25rem;"></div>
            
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0.8rem;">
                <div style="font-size:0.42rem;color:${primaryColor}88;">Issued ${formattedDate}</div>
                <div style="font-size:0.42rem;color:${primaryColor}88;">No. ${cert.registryId}</div>
                ${cert.domainName && cert.domainName !== '[domain.com]' ? `
                <div style="display:flex;align-items:center;gap:0.25rem;">
                    ${cert.claimToken 
                        ? `<img src="${getQRDataUrl(cert.claimUrl || '')}" alt="" style="width:22px;height:22px;">`
                        : `<div style="width:22px;height:22px;border:1px dashed ${primaryColor}40;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:0.5rem;color:${primaryColor}40;">QR</div>`}
                    <div style="font-size:0.38rem;color:${primaryColor}66;line-height:1.2;">Claim<br>domain</div>
                </div>` : ''}
            </div>
            
            <div style="height:2px;background:linear-gradient(90deg,transparent,${primaryColor},${secondaryColor},${primaryColor},transparent);margin:0.35rem 0 0;"></div>
        </div>
    </div>`;
}

// ===== UTILITY FUNCTIONS =====
// Fallback ID generator when server is unavailable (offline mode)
function fallbackRegistryId() {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TEMP-${year}-${random}`;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Generate QR code as an embedded data URL (no CORS issues with html2canvas)
const qrCache = {};
function getQRDataUrl(text) {
    if (!text) return '';
    if (qrCache[text]) return qrCache[text];
    // Generate QR code via external API, convert to data URL for embedding
    const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(text)}`;
    // For the initial render, use the external URL directly (browser loads it fine)
    // html2canvas captures it at capture time using canvas rendering below
    qrCache[text] = imgUrl;
    return imgUrl;
}

// Pre-convert QR images to data URLs for reliable html2canvas capture
async function ensureQRDataUrls() {
    const cert = currentCertificate;
    if (!cert.claimUrl) return;
    
    const url = cert.claimUrl;
    if (qrCache[url] && qrCache[url].startsWith('data:')) return; // Already converted
    
    try {
        const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 60;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 60, 60);
        qrCache[url] = canvas.toDataURL('image/png');
    } catch (e) {
        console.warn('QR data URL conversion failed, using fallback:', e.message);
    }
}

// ===== BILLING & CHECKOUT =====
const stripePublishableKey = 'pk_test_51Txa9ZRDgGi4zkadjEz5sK5vNTU3JNgslCFkygmKMGjTQKa080Tkkf11baDdaVbzEMyTnw6uGJ7kTk8aoH8b2jrD00tUNsVND8';
let stripe = null;
let stripeElements = null;
let stripeCard = null;

function printCertificate() {
    // Validate inputs
    if (!document.getElementById('recipientName').value) {
        alert('Please enter your name');
        return;
    }
    if (!document.getElementById('domainName').value) {
        alert('Please enter your domain name');
        return;
    }
    
    const btn = document.querySelector('[onclick="printCertificate()"], .btn-primary');
    const origText = btn?.textContent || '';
    if (btn) btn.textContent = 'Getting quote…';
    
    // Fetch Prodigi quote based on shipping address country
    const country = document.getElementById('billingCountry')?.value || 'US';
    const hasFrame = hasFramedOption();
    
    fetchProdigiQuotes(country, hasFrame).then(() => {
        // Populate billing page
        populateBilling();
        
        if (btn) btn.textContent = origText;
        
        // Navigate to billing panel
        navigateToPanel('#billing');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        // Initialize Stripe
        setTimeout(initStripe, 300);
    }).catch(() => {
        // Fallback: proceed without Prodigi quotes
        prodigiQuotes = [];
        populateBilling();
        if (btn) btn.textContent = origText;
        navigateToPanel('#billing');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        setTimeout(initStripe, 300);
    });
}

// Re-fetch Prodigi quote when country changes on billing page
function onBillingCountryChange() {
    const country = document.getElementById('billingCountry')?.value;
    const hasFrame = hasFramedOption();
    if (country) {
        fetchProdigiQuotes(country, hasFrame).then(() => populateBilling());
    }
}

function onDomainYearsChange() {
    populateBilling();
}

function initStripe() {
    if (stripe) return; // Already initialized
    if (typeof Stripe === 'undefined') return;
    
    stripe = Stripe(stripePublishableKey);
    stripeElements = stripe.elements();
    stripeCard = stripeElements.create('card', {
        style: {
            base: {
                fontSize: '15px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: '#e8e8e8',
                '::placeholder': { color: '#6b6b7a' },
                backgroundColor: 'transparent',
            },
        },
    });
    stripeCard.mount('#stripeCardElement');
    
    stripeCard.on('change', (event) => {
        const errorEl = document.getElementById('stripeCardError');
        if (event.error) {
            errorEl.textContent = event.error.message;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    });
}

// ===== PRODIGI PRINT FULFILLMENT =====
let prodigiQuotes = [];
let selectedShippingMethod = 'Standard';
let cachedCertDataUrl = null;
let backgroundRenderQueued = false;

// Background canvas cache — renders certificate after every preview update
// so it's instantly available when the user places the order
async function backgroundRenderCache() {
    const previewEl = document.getElementById('certCanvasInner');
    if (!previewEl || typeof html2canvas === 'undefined') return;
    try {
        const canvas = await html2canvas(previewEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
            logging: false,
        });
        cachedCertDataUrl = canvas.toDataURL('image/png');
    } catch (e) {
        // Silently ignore — will capture fresh on order if needed
    }
}

// Debounced wrapper: queues a single background render after changes settle
function queueBackgroundRender() {
    if (backgroundRenderQueued) return;
    backgroundRenderQueued = true;
    // Use rAF + setTimeout to let DOM settle after preview updates
    requestAnimationFrame(() => {
        setTimeout(() => {
            backgroundRenderQueued = false;
            backgroundRenderCache();
        }, 300);
    });
}

async function captureCertImage() {
    // Use cached version if available (instant), otherwise capture fresh
    if (cachedCertDataUrl) return cachedCertDataUrl;
    
    const previewEl = document.getElementById('certCanvasInner');
    if (!previewEl || typeof html2canvas === 'undefined') return null;
    try {
        const canvas = await html2canvas(previewEl, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: false,
            logging: false,
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error('Certificate capture error:', e);
        return null;
    }
}

async function uploadCertImage(dataUrl) {
    try {
        const res = await fetch('/api/upload-certificate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: dataUrl }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data.url;
    } catch (e) {
        console.error('Upload error:', e);
        return null;
    }
}

async function fetchProdigiQuotes(destinationCountryCode, hasFrame) {
    try {
        const res = await fetch('/api/prodigi-quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destinationCountryCode, hasFrame }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        prodigiQuotes = data.quotes || [];
        return prodigiQuotes;
    } catch (e) {
        console.error('Prodigi quote fetch error:', e);
        prodigiQuotes = [];
        return [];
    }
}

function getProdigiPrintCost() {
    // Find the selected shipping method quote, or fallback to Standard or first
    const quote = prodigiQuotes.find(q => q.method === selectedShippingMethod) 
        || prodigiQuotes.find(q => q.method === 'Standard') 
        || prodigiQuotes[0];
    if (!quote) return { itemCost: 0, shippingCost: 0, totalCost: 0 };
    return {
        itemCost: quote.itemCost,
        shippingCost: quote.shippingCost,
        totalCost: quote.totalCost,
    };
}

function renderShippingMethods() {
    const container = document.getElementById('shippingMethodOptions');
    if (!container) return;
    
    if (!prodigiQuotes || prodigiQuotes.length === 0) {
        container.innerHTML = '<p style="font-size:0.8rem;color:var(--text-secondary);margin:0;">Enter shipping country above to see delivery options.</p>';
        return;
    }
    
    // Method label mapping
    const labels = {
        'Budget': 'Budget',
        'Standard': 'Standard',
        'StandardPlus': 'Standard Plus',
        'Express': 'Express',
        'Overnight': 'Overnight',
    };
    
    const timeEstimates = {
        'Budget': '5–8 business days',
        'Standard': '3–6 business days',
        'StandardPlus': '2–5 business days',
        'Express': '1–3 business days',
        'Overnight': '1–2 business days',
    };
    
    // Sort: Standard first, then by price
    const sorted = [...prodigiQuotes].sort((a, b) => {
        if (a.method === 'Standard') return -1;
        if (b.method === 'Standard') return 1;
        return a.shippingCost - b.shippingCost;
    });
    
    let html = '';
    sorted.forEach((q, i) => {
        const label = labels[q.method] || q.method;
        const time = timeEstimates[q.method] || '';
        const isSelected = q.method === selectedShippingMethod;
        const carrierInfo = q.carrier && q.carrier !== 'Mixed' ? ` via ${q.carrier}` : '';
        
        html += `
            <label class="shipping-option ${isSelected ? 'shipping-option-selected' : ''}">
                <input type="radio" name="shippingMethod" value="${q.method}" 
                    ${isSelected ? 'checked' : ''}
                    onchange="selectShippingMethod('${q.method}')">
                <div class="shipping-option-info">
                    <div class="shipping-option-name">${label}</div>
                    <div class="shipping-option-time">${time}${carrierInfo}</div>
                </div>
                <div class="shipping-option-price">$${Math.round(q.shippingCost * (1 + MARGIN_PERCENT))}</div>
            </label>
        `;
    });
    
    container.innerHTML = html;
}

function selectShippingMethod(method) {
    selectedShippingMethod = method;
    renderShippingMethods();
    populateBilling();
}

function populateBilling() {
    const type = currentCertificate.type;
    const domainPrice = currentCertificate.domainPrice || 0;
    const hasFrame = (document.querySelector('input[name="displayOption"]:checked')?.value || 'frame') === 'frame';
    const hasScroll = !hasFrame;
    
    let itemsHtml = '';
    let subtotal = 0;
    
    // Prodigi Print & Shipping (real quote from Prodigi)
    const printCost = getProdigiPrintCost();
    
    // Tier label
    const typeLabel = type === 'Elite' ? 'Elite' : type === 'Premium' ? 'Premium' : 'Essential';
    const tierDescriptions = {
        'Essential': 'Basic certificate · essential design',
        'Premium': 'Certificate + frame upgrade included',
        'Elite': 'Full customization · frame included · gold foil',
    };
    
    // Custom alterations charge (non-Elite only)
    const hasAlterations = document.getElementById('certificateUpgrade')?.checked || false;
    let alterationsCost = 0;
    if (hasAlterations && type !== 'Elite') {
        alterationsCost = 5;
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Custom Alterations</div>
                    <div class="billing-item-desc">Personalized certificate customizations</div>
                </div>
                <span class="billing-item-price">$${Math.round(alterationsCost * (1 + MARGIN_PERCENT))}</span>
            </div>`;
    }
    
    // Print product
    if (hasScroll) {
        const printPrice = printCost.itemCost * (1 + MARGIN_PERCENT);
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Fine Art Print (Scroll)</div>
                    <div class="billing-item-desc">8×10" premium matte · ${typeLabel} tier · protective tube</div>
                </div>
                <div class="billing-item-price">$${printPrice.toFixed(2)}</div>
            </div>`;
        subtotal += printPrice;
    } else if (hasFrame) {
        const printPrice = printCost.itemCost * (1 + MARGIN_PERCENT);
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Framed Fine Art Print</div>
                    <div class="billing-item-desc">8×10" classic black frame · matted · ${typeLabel} tier</div>
                </div>
                <div class="billing-item-price">$${Math.round(printPrice)}</div>
            </div>`;
        subtotal += printPrice;
    }
    
    // Shipping
    const methodLabels = { 'Budget': 'Budget', 'Standard': 'Standard', 'StandardPlus': 'Standard Plus', 'Express': 'Express', 'Overnight': 'Overnight' };
    const shipMethodName = methodLabels[selectedShippingMethod] || selectedShippingMethod || 'Standard';
    const shippingPrice = printCost.shippingCost * (1 + MARGIN_PERCENT);
    const shipLabel = shippingPrice > 0 ? `$${Math.round(shippingPrice)}` : '—';
    itemsHtml += `
        <div class="billing-item">
            <div class="billing-item-left">
                <div class="billing-item-name">Shipping (${shipMethodName})</div>
                <div class="billing-item-desc">Delivery via premium print network</div>
            </div>
            <div class="billing-item-price">${shipLabel}</div>
        </div>`;
    subtotal += shippingPrice;
    
    // Domain (pass-through, no markup) — multiplied by years
    if (domainPrice > 0) {
        const years = parseInt(document.getElementById('domainYears')?.value) || 1;
        const totalDomainPrice = domainPrice * years;
        const yearLabel = years === 1 ? '1 year' : `${years} years`;
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Domain: ${escapeHtml(currentCertificate.domainName)}</div>
                    <div class="billing-item-desc">${yearLabel} · $${Math.round(domainPrice)}/yr (at cost)</div>
                </div>
                <div class="billing-item-price">$${Math.round(totalDomainPrice)}</div>
            </div>`;
        subtotal += totalDomainPrice;
    }
    
    const total = subtotal;
    
    document.getElementById('billingOrderItems').innerHTML = itemsHtml;
    document.getElementById('billingSubtotal').textContent = `$${Math.round(subtotal)}`;
    document.getElementById('billingShipping').textContent = shipLabel;
    document.getElementById('billingTotal').textContent = `$${Math.round(total)}`;
    
    // Render shipping method options
    renderShippingMethods();
    
    // Store domain years in certificate state
    currentCertificate.domainYears = parseInt(document.getElementById('domainYears')?.value) || 1;
    
    // Show/hide domain years selector
    const yearsSection = document.getElementById('domainYearsSection');
    if (yearsSection) {
        yearsSection.style.display = domainPrice > 0 ? 'flex' : 'none';
    }
    
    const recipientName = document.getElementById('recipientName').value || '';
    if (document.getElementById('billingFullName')) {
        document.getElementById('billingFullName').value = recipientName;
    }
}

async function placeOrder() {
    const name = document.getElementById('billingFullName')?.value.trim();
    const address = document.getElementById('billingAddress')?.value.trim();
    const city = document.getElementById('billingCity')?.value.trim();
    const state = document.getElementById('billingState')?.value.trim();
    const zip = document.getElementById('billingZip')?.value.trim();
    const country = document.getElementById('billingCountry')?.value;
    
    if (!name || !address || !city || !state || !zip || !country) {
        alert('Please fill in all shipping address fields.');
        return;
    }
    
    if (!stripe || !stripeCard) {
        alert('Payment system not loaded. Please try again.');
        return;
    }
    
    // Disable button
    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Preparing order…';
    
    try {
        // Step 1: Capture certificate as image (from background cache — instant)
        btn.textContent = 'Generating certificate…';
        
        // Ensure QR is up to date, then grab cached canvas
        await ensureQRDataUrls();
        if (cachedCertDataUrl) {
            // Re-render to pick up QR data URL, then update cache
            updatePreview();
            await backgroundRenderCache();
        }
        
        const certDataUrl = await captureCertImage();
        if (!certDataUrl) {
            alert('Failed to generate certificate image. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Place Order';
            return;
        }
        
        // Step 2: Upload certificate image to server
        btn.textContent = 'Uploading certificate…';
        const certImageUrl = await uploadCertImage(certDataUrl);
        if (!certImageUrl) {
            alert('Failed to upload certificate. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Place Order';
            return;
        }
        
        // Step 3: Calculate total and create payment intent
        const totalText = document.getElementById('billingTotal').textContent;
        const baseAmount = parseFloat(totalText.replace('$', ''));
        const items = [
            { name: `${currentCertificate.type} Certificate` },
        ];
        if (currentCertificate.domainPrice > 0) {
            items.push({ name: `Domain: ${currentCertificate.domainName}`, price: currentCertificate.domainPrice });
        }
        
        btn.textContent = 'Processing payment…';
        const result = await api('/api/create-payment-intent', {
            amount: baseAmount,
            items,
            shipping: { name, address, city, state, zip, country },
        });
        
        if (result.error) {
            alert('Payment error: ' + result.error);
            btn.disabled = false;
            btn.textContent = 'Place Order';
            return;
        }

        // Update billing display with tax from Stripe
        if (result.taxAmount > 0) {
            const taxRow = document.getElementById('billingTaxRow');
            const taxEl = document.getElementById('billingTax');
            if (taxRow) taxRow.style.display = 'flex';
            if (taxEl) taxEl.textContent = `$${Math.round(result.taxAmount)}`;
            if (result.totalAmount) {
                document.getElementById('billingTotal').textContent = `$${Math.round(result.totalAmount)}`;
            }
        }
        
        // Step 4: Confirm the card payment
        const { error, paymentIntent } = await stripe.confirmCardPayment(result.clientSecret, {
            payment_method: {
                card: stripeCard,
                billing_details: {
                    name: name,
                    address: {
                        line1: address,
                        city: city,
                        state: state,
                        postal_code: zip,
                        country: country === 'US' ? 'US' : undefined,
                    },
                },
            },
        });
        
        if (error) {
            document.getElementById('stripeCardError').textContent = error.message;
            document.getElementById('stripeCardError').classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Place Order';
            return;
        }
        
        if (paymentIntent.status === 'succeeded') {
            // Step 5: Purchase the domain via Name.com
            let domainPurchased = false;
            if (currentCertificate.domainPrice > 0 && currentCertificate.domainName && currentCertificate.domainName !== '[domain.com]') {
                try {
                    btn.textContent = 'Registering domain…';
                    const domainYears = parseInt(document.getElementById('domainYears')?.value) || 1;
                    const purchaseRes = await fetch('/api/purchase-domain', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            domain: currentCertificate.domainName,
                            years: domainYears,
                            registrantName: name,
                            registrantEmail: userEmail || email,
                            registrantPhone: '',
                            addressLine1: address,
                            addressCity: city,
                            addressState: state,
                            addressZip: zip,
                            addressCountry: country,
                        }),
                    });
                    const purchaseData = await purchaseRes.json();
                    if (purchaseData.success) {
                        domainPurchased = true;
                        console.log('Domain registered:', purchaseData.domain);
                    }
                } catch (e) {
                    console.log('Domain purchase deferred:', e.message);
                }
            }
            
            // Step 6: Create claim token for domain gifting
            let claimToken = null;
            let claimUrl = null;
            if (currentCertificate.domainName && currentCertificate.domainName !== '[domain.com]') {
                btn.textContent = 'Creating gift claim…';
                try {
                    const claimRes = await fetch('/api/create-claim', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            domainName: currentCertificate.domainName,
                            buyerName: name,
                            buyerEmail: userEmail,
                        }),
                    });
                    const claimData = await claimRes.json();
                    if (claimData.token) {
                        claimToken = claimData.token;
                        claimUrl = claimData.claimUrl;
                        currentCertificate.claimToken = claimToken;
                        currentCertificate.claimUrl = claimUrl;
                    }
                } catch (e) {
                    console.log('Claim creation skipped:', e.message);
                }
            }
            
            // Step 7: Create Prodigi print order
            btn.textContent = 'Placing print order…';
            
            const hasFrame = hasFramedOption();
            const printCost = getProdigiPrintCost();
            const userEmail = currentUser?.email || '';
            const finalTotalAmount = parseFloat(document.getElementById('billingTotal').textContent.replace('$', ''));
            
            const orderResult = await fetch('/api/prodigi-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientName: name,
                    email: userEmail,
                    address: {
                        line1: address,
                        line2: '',
                        townOrCity: city,
                        stateOrCounty: state,
                        postalOrZipCode: zip,
                        countryCode: country,
                    },
                    hasFrame,
                    frameColor: document.getElementById('frameWoodType')?.value || 'black',
                    shippingMethod: selectedShippingMethod || 'Standard',
                    certificateImageUrl: certImageUrl,
                    merchantReference: `DOTDEED-${Date.now()}`,
                    recipientCost: {
                        amount: Math.round(finalTotalAmount).toString(),
                        currency: 'USD',
                    },
                    certificateType: currentCertificate.type,
                    domainName: currentCertificate.domainName,
                    claimToken: claimToken,
                }),
            });
            
            const orderData = await orderResult.json();
            
            let successMsg = `Payment successful! 🎉

Your ${currentCertificate.type} certificate is being printed.`;
            if (orderData.orderId) {
                successMsg += `\n\n📦 Print order #: ${orderData.orderId}`;
                successMsg += `\n🔗 Track at: http://localhost:5000/?order=${orderData.orderId}`;
            }
            if (domainPurchased) {
                successMsg += `\n\n🌐 Domain ${currentCertificate.domainName} registered!`;
            }
            if (claimToken) {
                successMsg += `\n\n🎁 Domain gifting active!`;
                successMsg += `\nThe QR code on the certificate will let the recipient claim ${currentCertificate.domainName}.`;
                successMsg += `\n🔗 Claim link: ${claimUrl}`;
            }
            const finalTotal = document.getElementById('billingTotal').textContent;
            successMsg += `\n\nShipped to:\n${name}\n${address}\n${city}, ${state} ${zip}\n${country}\n\nOrder total: ${finalTotal}\n\nThank you for your order!`;
            
            alert(successMsg);
            
            // Reset
            stripeCard.clear();
            navigateToPanel('#storefront');
            updateNavActive('#storefront');
            btn.disabled = false;
            btn.textContent = 'Place Order';
        }
        
    } catch (err) {
        console.error('Order error:', err);
        alert('Payment succeeded but there was an issue creating the print order. Your payment has been processed. Please contact support with your order details.');
        btn.disabled = false;
        btn.textContent = 'Place Order';
    }
}

function closePaymentModal() {
    document.getElementById('paymentModalOverlay').classList.add('hidden');
}

function confirmPayment() {
    closePaymentModal();
    
    // Copy the certificate to print container
    const printContainer = document.getElementById('printContainer');
    const certificateCanvas = document.getElementById('certificatePreview').innerHTML;
    printContainer.innerHTML = `
        <div style="background-color: #ffffff; padding: 40px; font-family: Garamond, Georgia, 'Times New Roman', serif;">
            ${certificateCanvas}
        </div>
    `;
    
    showNotification('Payment confirmed! Printing certificate...');
    
    // Trigger print dialog
    setTimeout(() => {
        window.print();
    }, 100);
}

// ===== NOTIFICATIONS =====
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #6B0B22, #D62828);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        z-index: 9999;
        animation: slideInUp 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutDown 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

// Add animation styles if not already present
if (!document.querySelector('style[data-notifications]')) {
    const style = document.createElement('style');
    style.setAttribute('data-notifications', 'true');
    style.textContent = `
        @keyframes slideInUp {
            from {
                transform: translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        @keyframes slideOutDown {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(100px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

console.log('✓ Registry studio initialized');

// ===== ORDER STATUS TRACKING =====
// If page loaded with ?order=XXX query param, show order status
(async function checkOrderStatusOnLoad() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    if (!orderId) return;

    const statusPanel = document.getElementById('order-status');
    const content = document.getElementById('orderStatusContent');
    if (!statusPanel || !content) return;

    // Hide all other panels
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    statusPanel.style.display = 'block';

    try {
        const res = await fetch(`/api/order-status?order=${encodeURIComponent(orderId)}`);
        const data = await res.json();
        
        if (data.error) {
            content.innerHTML = `<p style="color:var(--danger);">Order not found. Please check the order ID.</p>`;
            return;
        }

        const statusLabels = {
            'pending': '⏳ Pending',
            'submitted': '✅ Submitted',
            'in_progress': '🖨️ Printing',
            'completed': '📬 Shipped',
            'cancelled': '❌ Cancelled',
        };

        const prodigiStatus = data.prodigiStatus || data.status;
        const label = statusLabels[prodigiStatus] || prodigiStatus || 'Unknown';

        content.innerHTML = `
            <div style="background:rgba(107,11,34,0.06);border-radius:12px;padding:1.5rem;border:1px solid rgba(107,11,34,0.1);">
                <div style="font-size:2rem;margin-bottom:1rem;">${label.split(' ')[0]}</div>
                <div style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem;">${label}</div>
                <hr style="border:none;border-top:1px solid rgba(107,11,34,0.1);margin:1rem 0;">
                <div style="font-size:0.85rem;color:var(--text-secondary);">
                    <p><strong>Order:</strong> ${data.prodigiOrderId}</p>
                    <p><strong>Certificate:</strong> ${data.certificateType || 'N/A'}</p>
                    <p><strong>Recipient:</strong> ${data.recipientName || 'N/A'}</p>
                    <p><strong>Shipping to:</strong> ${data.shippingAddress || 'N/A'}</p>
                    <p><strong>Ordered:</strong> ${data.createdAt || 'N/A'}</p>
                    <p><strong>Last updated:</strong> ${data.updatedAt || 'N/A'}</p>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<p style="color:var(--danger);">Failed to load order status. Please try again later.</p>`;
    }
})();

// ===== CLAIM PAGE =====
(async function checkClaimOnLoad() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    const claimPanel = document.getElementById('claim-page');
    const statusDiv = document.getElementById('claimStatus');
    if (!claimPanel || !statusDiv) return;

    // Hide all other panels
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    claimPanel.style.display = 'block';

    try {
        const res = await fetch(`/api/claim/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (data.error) {
            statusDiv.innerHTML = `<p style="color:var(--danger);">This claim link is invalid or expired.</p>`;
            return;
        }

        if (data.status === 'claimed') {
            statusDiv.innerHTML = `
                <div style="background:rgba(107,11,34,0.06);border-radius:12px;padding:1.5rem;border:1px solid rgba(107,11,34,0.1);">
                    <div style="font-size:2rem;margin-bottom:0.5rem;">✅</div>
                    <h3 style="margin:0.5rem 0;">${data.domainName}</h3>
                    <p style="color:var(--text-secondary);">This domain has already been claimed.</p>
                </div>
            `;
            return;
        }

        // Show claim form
        statusDiv.innerHTML = `
            <div style="background:rgba(107,11,34,0.06);border-radius:12px;padding:1.5rem;border:1px solid rgba(107,11,34,0.1);">
                <div style="font-size:1.5rem;font-weight:600;margin-bottom:0.25rem;color:var(--deep-maroon);">${data.domainName}</div>
                <p style="color:var(--text-secondary);margin-bottom:1.5rem;">${data.buyerName ? data.buyerName + ' has' : 'Someone has'} gifted you this domain! Enter your email to claim it.</p>
                <form id="claimForm" onsubmit="return submitClaim('${token}')">
                    <input type="email" id="claimEmail" placeholder="your@email.com" required
                        style="width:100%;padding:0.7rem 1rem;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:inherit;font-size:0.95rem;margin-bottom:0.75rem;box-sizing:border-box;">
                    <button type="submit"
                        style="width:100%;padding:0.7rem 1rem;border-radius:6px;border:none;background:var(--deep-maroon);color:#fff;font-size:0.95rem;font-weight:600;cursor:pointer;">
                        Claim My Domain
                    </button>
                    <p id="claimError" style="color:var(--danger);font-size:0.85rem;margin-top:0.5rem;display:none;"></p>
                </form>
            </div>
        `;
    } catch (e) {
        statusDiv.innerHTML = `<p style="color:var(--danger);">Failed to load. Please try again later.</p>`;
    }
})();

async function submitClaim(token) {
    const email = document.getElementById('claimEmail')?.value;
    const errorEl = document.getElementById('claimError');
    if (!email || !email.includes('@')) {
        if (errorEl) { errorEl.textContent = 'Please enter a valid email address.'; errorEl.style.display = 'block'; }
        return false;
    }

    try {
        const res = await fetch(`/api/claim/${encodeURIComponent(token)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (data.error) {
            if (errorEl) { errorEl.textContent = data.error; errorEl.style.display = 'block'; }
            return false;
        }

        document.getElementById('claimStatus').innerHTML = `
            <div style="background:rgba(107,11,34,0.06);border-radius:12px;padding:1.5rem;border:1px solid rgba(107,11,34,0.1);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">🎉</div>
                <h3 style="margin:0.5rem 0;">${data.domainName} is yours!</h3>
                <p style="color:var(--text-secondary);">Check your email for next steps to manage your domain.</p>
            </div>
        `;
    } catch (e) {
        if (errorEl) { errorEl.textContent = 'Something went wrong. Please try again.'; errorEl.style.display = 'block'; }
    }
    return false;
}

// ===== COOKIE CONSENT =====
function acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookieBanner').style.display = 'none';
}

(function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    if (!localStorage.getItem('cookieConsent')) {
        // Show after a brief delay
        setTimeout(() => {
            banner.style.display = 'block';
            banner.style.animation = 'slideInUp 0.4s ease';
        }, 800);
    }
})();
