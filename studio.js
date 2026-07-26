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
            currentUser = { username: result.username, registryId: result.registryId };
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
    customizationNotes: ''
};

// ===== PRICING =====
const CERT_PRICES = {
    Essential: 15,
    Premium: 30,
    Elite: 50
};

function getDomainPrice(domainName) {
    if (!domainName || domainName === '[domain.com]') return 0;
    const domain = domainShopperCatalog.find(d => d.name === domainName);
    return domain ? domain.price : 0;
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
    // Create debounced version here — updatePreview is guaranteed to be defined by DOMContentLoaded
    const debouncedPreview = debounce(updatePreview);
    
    // All studio form inputs that should trigger a live preview update
    const previewInputs = [
        'recipientName', 'domainName', 'issueDate', 'certificateUpgrade',
        'upgradeNotes', 'fontStyle', 'primaryColor', 'secondaryColor',
        'borderStyle', 'sealStyle', 'paperTexture', 'awardTitle',
        'cornerOrnamentStyle', 'filigreePattern', 'goldFoilAccent',
        'frameUpgrade', 'frameWoodType'
    ];

    previewInputs.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventType = el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'date'
            ? 'input' : 'change';
        el.addEventListener(eventType, debouncedPreview);
    });
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
    document.getElementById('frameUpgrade').checked = false;
    document.getElementById('frameWoodType').value = 'walnut';
    document.getElementById('businessCardOption').checked = false;
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
    
    // Reset business card for non-Elite
    if (tier !== 'Elite') {
        document.getElementById('businessCardOption').checked = false;
    }
    
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
    renderFilteredDomains('');
}

let activeTldFilter = 'all';
let activePriceRange = 'all';
let activeSort = 'default';
let availableOnly = false;

function filterByTLD(tld) {
    activeTldFilter = tld;
    document.querySelectorAll('.tld-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tld === tld);
    });
    const input = document.getElementById('domainSearchInput');
    renderFilteredDomains(input.value);
}

function filterByPriceRange(range) {
    activePriceRange = range;
    document.querySelectorAll('.price-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });
    const input = document.getElementById('domainSearchInput');
    renderFilteredDomains(input.value);
}

function applySort() {
    activeSort = document.getElementById('sortSelect').value;
    const input = document.getElementById('domainSearchInput');
    renderFilteredDomains(input.value);
}

function toggleAvailableOnly() {
    availableOnly = document.getElementById('availableOnly').checked;
    const input = document.getElementById('domainSearchInput');
    renderFilteredDomains(input.value);
}

function renderFilteredDomains(filter) {
    const container = document.getElementById('domainShopperGrid');
    if (!container) return;

    const query = (filter || '').toLowerCase().trim();
    const tldFilter = activeTldFilter === 'all' ? null : activeTldFilter;

    let filtered = domainShopperCatalog.filter(d => {
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
        if (availableOnly && !getDomainAvailability(d.name)) return false;

        // Search query
        if (query) {
            return d.name.toLowerCase().includes(query) ||
                   d.description.toLowerCase().includes(query) ||
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

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="shopper-empty">
                <div class="shopper-empty-icon">🔍</div>
                <h3>No domains found</h3>
                <p>Try adjusting your filters or <a href="#" onclick="resetAllFilters(); return false;">reset all filters</a>.</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(domain => {
        const tld = '.' + domain.name.split('.').pop();
        const isPremium = domain.price >= 200;
        const isBudget = domain.price <= 50;
        const available = getDomainAvailability(domain.name);
        
        return `
        <article class="shopper-card ${available ? 'available' : ''}">
            <div class="shopper-card-badge">
                <span class="domain-tld-tag" style="background: ${getTldColor(tld)}">${tld}</span>
                ${isPremium ? '<span class="domain-premium-tag">Premium</span>' : ''}
                ${isBudget ? '<span class="domain-budget-tag">Value</span>' : ''}
                <span class="domain-availability ${available ? 'available' : 'taken'}">${available ? '✓ Available' : 'Taken'}</span>
            </div>
            <div class="shopper-card-top">
                <h3>${escapeHtml(domain.name)}</h3>
                <span class="shopper-price">$${domain.price}<span class="price-period">/yr</span></span>
            </div>
            <p>${escapeHtml(domain.description)}</p>
            <div class="shopper-card-actions">
                <button class="shopper-btn" onclick="selectDomainForCertificate('${domain.name}')">
                    ${available ? 'Use this domain' : 'View alternatives'}
                </button>
            </div>
        </article>`;
    }).join('');
}

function filterDomains() {
    const input = document.getElementById('domainSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const query = input.value;
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    renderFilteredDomains(query);
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

    renderFilteredDomains('');
    document.getElementById('domainSearchInput').focus();
}

// Simulate domain availability (80% chance available)
function getDomainAvailability(domainName) {
    // Use a simple hash to keep availability consistent per domain
    let hash = 0;
    for (let i = 0; i < domainName.length; i++) {
        hash = ((hash << 5) - hash) + domainName.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 10 < 8; // 80% available
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
        document.getElementById('frameUpgrade').checked = false;
        document.getElementById('businessCardOption').checked = false;
        document.getElementById('certificateUpgrade').checked = false;
    }

    const upgradeNotesSection = document.getElementById('upgradeNotesSection');
    if (upgradeNotesSection) {
        upgradeNotesSection.classList.toggle('hidden', !currentCertificate.customizationEnabled);
    }

    const tierCustomizationSection = document.getElementById('tierCustomizationSection');
    const frameOptionsSection = document.getElementById('frameOptionsSection');
    const businessCardSection = document.getElementById('businessCardSection');
    const capabilities = getTierCapabilities(currentCertificate.type);
    if (tierCustomizationSection) {
        tierCustomizationSection.classList.toggle('hidden', !(currentCertificate.customizationEnabled && capabilities.canChangeFont));
    }
    if (frameOptionsSection) {
        frameOptionsSection.classList.toggle('hidden', !document.getElementById('frameUpgrade').checked);
    }
    if (businessCardSection) {
        const type = currentCertificate.type.toLowerCase();
        businessCardSection.classList.toggle('hidden', type === 'essential');
    }

    const certHTML = renderCertificate(currentCertificate);
    const hasFrame = document.getElementById('frameUpgrade')?.checked || false;
    const frameWoodType = document.getElementById('frameWoodType')?.value || 'walnut';
    
    const innerContainer = document.getElementById('certCanvasInner');
    if (innerContainer) {
        if (hasFrame) {
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
        } else {
            innerContainer.innerHTML = certHTML;
        }
    }
    
}

function renderCertificate(cert) {
    const formattedDate = formatDate(cert.issueDate);
    const capabilities = getTierCapabilities(cert.type);
    const customizationEnabled = cert.customizationEnabled;
    
    const fontFamily = customizationEnabled && capabilities.canChangeFont ? document.getElementById('fontStyle')?.value || 'Georgia' : 'Georgia';
    const primaryColor = customizationEnabled && capabilities.canChangePrimaryColor ? document.getElementById('primaryColor')?.value || '#6B0B22' : '#6B0B22';
    const secondaryColor = customizationEnabled && capabilities.canChangeSecondaryColor ? document.getElementById('secondaryColor')?.value || '#D62828' : '#D62828';
    const borderStyle = customizationEnabled && capabilities.canChangeBorderStyle ? document.getElementById('borderStyle')?.value || 'classic' : 'classic';
    
    // New customization options
    const sealStyle = customizationEnabled && capabilities.canChangeSealStyle ? document.getElementById('sealStyle')?.value || 'classic' : 'classic';
    const paperTexture = customizationEnabled && capabilities.canChangePaperTexture ? document.getElementById('paperTexture')?.value || 'smooth' : 'smooth';
    const awardTitle = customizationEnabled && capabilities.canChangeAwardTitle ? (document.getElementById('awardTitle')?.value || 'Digital Domain Holder') : 'Digital Domain Holder';
    const goldFoil = customizationEnabled && capabilities.canUseGoldFoil ? document.getElementById('goldFoilAccent')?.checked || false : false;
    const cornerOrnament = customizationEnabled && capabilities.canChangeCornerOrnament ? document.getElementById('cornerOrnamentStyle')?.value || 'classic' : 'classic';
    const filigreePattern = customizationEnabled && capabilities.canChangeFiligree ? document.getElementById('filigreePattern')?.value || 'none' : 'none';
    
    let businessCardMarkup = '';
    if (cert.type.toLowerCase() === 'elite' && document.getElementById('businessCardOption')?.checked) {
        const bizName = document.getElementById('bizName')?.value || cert.recipientName || 'Your Name';
        const bizTitle = document.getElementById('bizTitle')?.value || 'Digital Estate Holder';
        const bizCompany = document.getElementById('bizCompany')?.value || 'DOT DEED';
        const bizDomain = document.getElementById('bizDomain')?.value || cert.domainName || 'domain.com';
        const bizEmail = document.getElementById('bizEmail')?.value || '';
        const bizPhone = document.getElementById('bizPhone')?.value || '';
        const bizAccent = document.getElementById('bizCardColor')?.value || '#6B0B22';
        const bizFont = document.getElementById('bizCardFont')?.value || 'Georgia';
        const bizLayout = document.getElementById('bizCardLayout')?.value || 'classic';
        const bizShowLogo = document.getElementById('bizCardLogo')?.checked;
        
        const bizContact = [bizEmail, bizPhone].filter(Boolean).length > 0
            ? `<div style="font-size:0.55rem;color:#a1a1a6;margin-top:3px;">${[bizEmail, bizPhone].filter(Boolean).join(' · ')}</div>`
            : '';
        const bizLogoMarkup = bizShowLogo ? `<img src="image copy.png" style="position:absolute;top:6px;right:8px;width:20px;opacity:0.12;">` : '';
        
        businessCardMarkup = `
            <div style="margin: 0.75rem auto 0; padding: 0.65rem 0.85rem; border: 1px dashed ${secondaryColor}; border-radius: 6px; display: inline-block; text-align: left; position: relative; font-family: ${bizFont}; width: 100%; max-width: 240px;">
                ${bizLogoMarkup}
                <div style="font-size:0.75rem;font-weight:700;color:#1d1d1f;">${escapeHtml(bizName)}</div>
                <div style="font-size:0.5rem;color:${bizAccent};font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${escapeHtml(bizTitle)}</div>
                <div style="width:24px;height:1.5px;background:${bizAccent};margin:4px 0;"></div>
                <div style="font-size:0.5rem;color:#86868b;">${escapeHtml(bizCompany)}</div>
                <div style="font-size:0.55rem;color:${bizAccent};font-weight:600;font-family:'Courier New',monospace;">${escapeHtml(bizDomain)}</div>
                ${bizContact}
            </div>`;
    }
    const customizationMarkup = customizationEnabled ? `<div class="cert-notes" style="font-style: italic; font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.75rem;">${escapeHtml(cert.customizationNotes || '')}</div>` : '';

    const borderVariant = borderStyle === 'double' ? 'cert-border-double' : borderStyle === 'ornate' ? 'cert-border-ornate' : 'cert-border-classic';
    const paperClass = 'paper-' + paperTexture;
    const foilClass = goldFoil ? 'gold-foil' : '';
    const cornerClass = 'corner-' + cornerOrnament;
    const filigreeClass = filigreePattern !== 'none' ? 'filigree-' + filigreePattern : '';

    // === SEAL SVG BY STYLE ===
    let sealSvg = '';
    if (sealStyle === 'shield') {
        sealSvg = `
            <svg class="seal-svg" viewBox="0 0 120 120" fill="none">
                <path d="M 60 10 L 100 30 L 100 70 Q 100 95, 60 110 Q 20 95, 20 70 L 20 30 Z" stroke="${primaryColor}" stroke-width="2" fill="${primaryColor}08"/>
                <path d="M 60 18 L 92 34 L 92 68 Q 92 90, 60 102 Q 28 90, 28 68 L 28 34 Z" stroke="${secondaryColor}" stroke-width="0.8" fill="none" stroke-dasharray="2.5 2.5"/>
                <path d="M 50 50 L 60 38 L 70 50 L 60 62 Z" fill="${primaryColor}22" stroke="${primaryColor}" stroke-width="1.5"/>
                <circle cx="60" cy="50" r="3" fill="${secondaryColor}"/>
                <text x="60" y="80" text-anchor="middle" font-size="7" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
            </svg>`;
    } else if (sealStyle === 'modern') {
        sealSvg = `
            <svg class="seal-svg" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="52" stroke="${primaryColor}" stroke-width="1.5" fill="none"/>
                <circle cx="60" cy="60" r="46" stroke="${secondaryColor}" stroke-width="1" fill="none"/>
                <rect x="35" y="35" width="50" height="50" rx="4" fill="${primaryColor}10" stroke="${primaryColor}" stroke-width="1.5"/>
                <text x="60" y="58" text-anchor="middle" font-size="9" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
                <line x1="35" y1="75" x2="85" y2="75" stroke="${secondaryColor}" stroke-width="0.8"/>
                <line x1="35" y1="78" x2="85" y2="78" stroke="${secondaryColor}" stroke-width="0.8"/>
            </svg>`;
    } else if (sealStyle === 'ornate') {
        sealSvg = `
            <svg class="seal-svg" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="56" stroke="${primaryColor}" stroke-width="2" fill="none"/>
                <circle cx="60" cy="60" r="50" stroke="${secondaryColor}" stroke-width="0.8" fill="none" stroke-dasharray="4 3"/>
                <circle cx="60" cy="60" r="44" stroke="${primaryColor}" stroke-width="0.5" fill="none"/>
                <path d="M 35 60 A 25 25 0 0 1 85 60" stroke="${secondaryColor}" stroke-width="1.2" fill="none"/>
                <path d="M 85 60 A 25 25 0 0 1 35 60" stroke="${secondaryColor}" stroke-width="1.2" fill="none"/>
                <path d="M 40 60 L 60 42 L 80 60 L 60 78 Z" fill="${primaryColor}22" stroke="${primaryColor}" stroke-width="1"/>
                <circle cx="60" cy="60" r="5" fill="${secondaryColor}"/>
                <text x="60" y="63" text-anchor="middle" font-size="6" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
            </svg>`;
    } else {
        // Classic round (default)
        sealSvg = `
            <svg class="seal-svg" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="56" stroke="${primaryColor}" stroke-width="2" fill="none"/>
                <circle cx="60" cy="60" r="50" stroke="${primaryColor}" stroke-width="0.5" fill="none"/>
                <circle cx="60" cy="60" r="44" stroke="${secondaryColor}" stroke-width="1" fill="none" stroke-dasharray="3 3"/>
                <path d="M 40 60 L 60 45 L 80 60 L 60 75 Z" fill="${primaryColor}22" stroke="${primaryColor}" stroke-width="1"/>
                <circle cx="60" cy="60" r="6" fill="${secondaryColor}"/>
                <text x="60" y="58" text-anchor="middle" font-size="8" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
            </svg>`;
    }

    // === CORNER ORNAMENTS ===
    let cornerMarkup = '';
    if (cornerOrnament === 'none') {
        cornerMarkup = '';
    } else if (cornerOrnament === 'victorian') {
        cornerMarkup = `
            <div class="corner-ornament corner-ornament-tl" style="color: ${primaryColor};"><span class="corner-flourish">❧</span></div>
            <div class="corner-ornament corner-ornament-tr" style="color: ${primaryColor};"><span class="corner-flourish">❧</span></div>
            <div class="corner-ornament corner-ornament-bl" style="color: ${primaryColor};"><span class="corner-flourish">❧</span></div>
            <div class="corner-ornament corner-ornament-br" style="color: ${primaryColor};"><span class="corner-flourish">❧</span></div>`;
    } else if (cornerOrnament === 'artdeco') {
        cornerMarkup = `
            <div class="corner-ornament corner-ornament-tl" style="color: ${primaryColor};"><span class="corner-flourish">◇</span></div>
            <div class="corner-ornament corner-ornament-tr" style="color: ${primaryColor};"><span class="corner-flourish">◇</span></div>
            <div class="corner-ornament corner-ornament-bl" style="color: ${primaryColor};"><span class="corner-flourish">◇</span></div>
            <div class="corner-ornament corner-ornament-br" style="color: ${primaryColor};"><span class="corner-flourish">◇</span></div>`;
    } else {
        // Classic corner decorations (original)
        cornerMarkup = `
            <div class="corner corner-tl"></div>
            <div class="corner corner-tr"></div>
            <div class="corner corner-bl"></div>
            <div class="corner corner-br"></div>`;
    }

    // === FILIGREE PATTERN ===
    let filigreeMarkup = '';
    if (filigreePattern === 'subtle') {
        filigreeMarkup = `<div class="cert-filigree cert-filigree-subtle" style="color: ${primaryColor};">
            <div class="filigree-border-top"></div>
            <div class="filigree-border-bottom"></div>
        </div>`;
    } else if (filigreePattern === 'ornate') {
        filigreeMarkup = `<div class="cert-filigree cert-filigree-ornate" style="color: ${primaryColor};">
            <div class="filigree-border-top"><span>✻</span><span>✿</span><span>✻</span><span>✿</span><span>✻</span></div>
            <div class="filigree-border-bottom"><span>✻</span><span>✿</span><span>✻</span><span>✿</span><span>✻</span></div>
        </div>`;
    } else if (filigreePattern === 'geometric') {
        filigreeMarkup = `<div class="cert-filigree cert-filigree-geometric" style="color: ${primaryColor};">
            <div class="filigree-border-top"><span>◈</span><span>◇</span><span>◈</span><span>◇</span><span>◈</span></div>
            <div class="filigree-border-bottom"><span>◈</span><span>◇</span><span>◈</span><span>◇</span><span>◈</span></div>
        </div>`;
    }

    const goldFoilClass = goldFoil ? 'gold-foil' : '';

    return `
        <div class="certificate-wrapper ${borderVariant} ${paperClass} ${goldFoilClass} ${filigreeClass}">
            ${cornerMarkup}
            ${filigreeMarkup}
            
            <img class="cert-watermark-logo" src="image copy.png" alt="" aria-hidden="true">
            
            <div class="certificate-inner">
                <!-- Top Latin Motto -->
                <div class="cert-motto ${goldFoilClass}" style="font-family: ${fontFamily};">VERITAS · DIGITALIS · HONOR</div>
                
                <!-- Decorative divider -->
                <div class="cert-divider">
                    <span class="divider-ornament">❧</span>
                </div>

                <!-- Seal / Crest -->
                <div class="cert-seal-large seal-${sealStyle} ${goldFoilClass}" style="color: ${primaryColor};">
                    ${sealSvg}
                </div>

                <!-- Institution Name -->
                <div class="cert-top" style="font-family: ${fontFamily};">
                    <div class="cert-institution ${goldFoilClass}" style="color: ${primaryColor};">DOT DEED</div>
                    <div class="cert-department" style="color: ${secondaryColor};">Registry of Digital Estates</div>
                </div>

                <!-- Decorative divider -->
                <div class="cert-divider">
                    <span class="divider-line" style="background: ${primaryColor};"></span>
                    <span class="divider-ornament ${goldFoilClass}" style="color: ${primaryColor};">⚜</span>
                    <span class="divider-line" style="background: ${primaryColor};"></span>
                </div>

                <!-- Certificate Body -->
                <div class="cert-body">
                    <div class="cert-preface" style="color: ${primaryColor};">
                        By the authority vested in the Registry of Digital Estates, it is hereby certified that
                    </div>
                    
                    <div class="cert-recipient ${goldFoilClass}" style="font-family: ${fontFamily};">
                        ${escapeHtml(cert.recipientName)}
                    </div>
                    
                    <div class="cert-preface">
                        having fulfilled all requirements and demonstrated rightful stewardship, is hereby granted the title of
                    </div>
                    
                    <div class="cert-degree ${goldFoilClass}" style="color: ${primaryColor}; border-color: ${secondaryColor};">
                        ${escapeHtml(awardTitle)}
                    </div>
                    
                    <div class="cert-domain-wrapper">
                        <span class="cert-domain-label">Network Namespace:</span>
                        <span class="cert-domain ${goldFoilClass}" style="background: ${primaryColor};">
                            ${escapeHtml(cert.domainName).toLowerCase()}
                        </span>
                    </div>
                    
                    <div class="cert-preface" style="font-size: 0.85rem;">
                        In witness whereof, this certificate is issued under the seal of the Registry and attested by the undersigned officers.
                    </div>
                    
                    ${customizationMarkup}
                    ${businessCardMarkup}
                </div>

                <!-- Signatures -->
                <div class="cert-footer">
                    <div class="signature-block">
                        <div class="signature-line" style="background: ${primaryColor};"></div>
                        <div class="signature-label ${goldFoilClass}" style="color: ${primaryColor};">Registrar</div>
                        <div class="signature-title">Officer of the Registry</div>
                    </div>
                    
                    <div class="signature-seal ${goldFoilClass}">
                        <svg viewBox="0 0 40 40" width="40" height="40">
                            <circle cx="20" cy="20" r="18" stroke="${primaryColor}" stroke-width="1" fill="none"/>
                            <text x="20" y="22" text-anchor="middle" font-size="10" font-weight="bold" fill="${secondaryColor}" font-family="serif">DD</text>
                        </svg>
                    </div>
                    
                    <div class="signature-block">
                        <div class="signature-line" style="background: ${primaryColor};"></div>
                        <div class="signature-label ${goldFoilClass}" style="color: ${primaryColor};">Chancellor</div>
                        <div class="signature-title">Dean of Digital Estates</div>
                    </div>
                </div>

                <!-- Bottom details -->
                <div class="cert-bottom">
                    <div class="cert-divider">
                        <span class="divider-line" style="background: ${primaryColor}; opacity: 0.3;"></span>
                    </div>
                    <div class="cert-date">Issued this ${formattedDate}</div>
                    <div class="cert-id">Certificate No. ${cert.registryId}</div>
                </div>
            </div>
        </div>
    `;
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

// ===== BILLING & CHECKOUT =====
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
    
    // Populate billing page
    populateBilling();
    
    // Navigate to billing panel
    navigateToPanel('#billing');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
}

function populateBilling() {
    const type = currentCertificate.type;
    const certPrice = CERT_PRICES[type] || 15;
    const domainPrice = currentCertificate.domainPrice || 0;
    const hasFrame = document.getElementById('frameUpgrade')?.checked || false;
    const hasBizCard = document.getElementById('businessCardOption')?.checked || false;
    
    let itemsHtml = '';
    let subtotal = 0;
    
    // Certificate item
    const typeLabel = type === 'Elite' ? 'Elite (all add-ons included)' : type === 'Premium' ? 'Premium (alterations included)' : type;
    itemsHtml += `
        <div class="billing-item">
            <div class="billing-item-left">
                <div class="billing-item-name">${typeLabel} Certificate</div>
                <div class="billing-item-desc">Digital domain ownership certificate</div>
            </div>
            <div class="billing-item-price">$${certPrice.toFixed(2)}</div>
        </div>`;
    subtotal += certPrice;
    
    // Domain
    if (domainPrice > 0) {
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Domain: ${escapeHtml(currentCertificate.domainName)}</div>
                    <div class="billing-item-desc">Premium domain registration</div>
                </div>
                <div class="billing-item-price">$${domainPrice.toFixed(2)}</div>
            </div>`;
        subtotal += domainPrice;
    }
    
    // Frame
    if (hasFrame) {
        const framePrice = type === 'Elite' ? 0 : 12;
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Display Frame</div>
                    <div class="billing-item-desc">${type === 'Elite' ? 'Included with Elite' : 'Premium wood finish'}</div>
                </div>
                <div class="billing-item-price">${type === 'Elite' ? 'FREE' : '$12.00'}</div>
            </div>`;
        subtotal += framePrice;
    }
    
    // Business card
    if (hasBizCard) {
        const bizCardPrice = type === 'Elite' ? 0 : 8;
        itemsHtml += `
            <div class="billing-item">
                <div class="billing-item-left">
                    <div class="billing-item-name">Business Card</div>
                    <div class="billing-item-desc">${type === 'Elite' ? 'Included with Elite' : 'Matching business card layout'}</div>
                </div>
                <div class="billing-item-price">${type === 'Elite' ? 'FREE' : '$8.00'}</div>
            </div>`;
        subtotal += bizCardPrice;
    }
    
    // Shipping estimate based on subtotal
    const shipping = subtotal >= 50 ? 0 : subtotal > 0 ? 9.99 : 0;
    const shippingLabel = subtotal >= 50 ? 'FREE' : '$9.99';
    const total = subtotal + (subtotal >= 50 ? 0 : shipping);
    
    document.getElementById('billingOrderItems').innerHTML = itemsHtml;
    document.getElementById('billingSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('billingShipping').textContent = shippingLabel;
    document.getElementById('billingTotal').textContent = `$${total.toFixed(2)}`;
    
    // Pre-fill name from certificate
    const recipientName = document.getElementById('recipientName').value || '';
    if (document.getElementById('billingFullName')) {
        document.getElementById('billingFullName').value = recipientName;
    }
}

function placeOrder() {
    // Validate address
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
    
    // Show confirmation
    const orderTotal = document.getElementById('billingTotal').textContent;
    alert(`Order placed!\n\nYour ${currentCertificate.type} certificate will be shipped to:\n${name}\n${address}\n${city}, ${state} ${zip}\n${country}\n\nTotal charged: ${orderTotal}\n\nThank you for your order!`);
    
    // Navigate back to home
    navigateToPanel('#storefront');
    updateNavActive('#storefront');
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

// ===== BUSINESS CARD EDITOR =====
function onBizCardToggle() {
    const checked = document.getElementById('businessCardOption').checked;
    const btn = document.getElementById('openBizCardBtn');
    if (btn) btn.classList.toggle('hidden', !checked);
    updatePreview();
}

function openBizCardEditor() {
    // Pre-fill fields from certificate data
    const cert = currentCertificate;
    document.getElementById('bizName').value = cert.recipientName || '';
    document.getElementById('bizDomain').value = cert.domainName || '';
    
    // If no title set, use a default
    if (!document.getElementById('bizTitle').value) {
        document.getElementById('bizTitle').value = 'Digital Estate Holder';
    }
    
    updateBizCardPreview();
    navigateToPanel('#bizcard-editor');
}

function closeBizCardEditor() {
    navigateToPanel('#studio');
}

function updateBizCardPreview() {
    const name = document.getElementById('bizName').value || 'Your Name';
    const title = document.getElementById('bizTitle').value || 'Digital Estate Holder';
    const company = document.getElementById('bizCompany').value || 'DOT DEED';
    const domain = document.getElementById('bizDomain').value || 'domain.com';
    const email = document.getElementById('bizEmail').value || '';
    const phone = document.getElementById('bizPhone').value || '';
    const accent = document.getElementById('bizCardColor').value || '#6B0B22';
    const font = document.getElementById('bizCardFont').value || 'Georgia';
    const layout = document.getElementById('bizCardLayout').value || 'classic';
    const showLogo = document.getElementById('bizCardLogo').checked;
    
    const container = document.getElementById('bizCardPreviewInner');
    if (!container) return;
    
    // Compute light accent for gradients
    const accentLight = accent + '18';
    
    const logoMarkup = showLogo ? `<img class="bizcard-render-logo" src="image copy.png" alt="">` : '';
    const contactMarkup = [email, phone].filter(Boolean).length > 0
        ? `<div class="bizcard-render-contact">${[email, phone].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>`
        : '';
    
    container.innerHTML = `
        <div class="bizcard-render bizcard-render-${layout}" style="font-family: ${font}; --biz-accent: ${accent}; --biz-accent-light: ${accentLight};">
            ${logoMarkup}
            <div class="bizcard-render-name">${escapeHtml(name)}</div>
            <div class="bizcard-render-title">${escapeHtml(title)}</div>
            <div class="bizcard-render-divider"></div>
            <div class="bizcard-render-company">${escapeHtml(company)}</div>
            <div class="bizcard-render-domain">${escapeHtml(domain)}</div>
            ${contactMarkup}
        </div>
    `;
}

function saveBizCard() {
    // The business card data is now saved in the DOM fields
    // Just close and refresh the certificate preview
    showNotification('Business card updated!');
    closeBizCardEditor();
    updatePreview();
}

console.log('✓ Registry studio initialized');
