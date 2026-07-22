// ===== DOMAIN DATA =====
const domains = [
    {
        id: 1,
        name: 'innovate.dev',
        extension: '.dev',
        category: 'tech',
        categoryDisplay: 'Technology',
        price: 150,
        description: 'Perfect for forward-thinking tech startups and innovation hubs. This domain conveys cutting-edge technology and visionary development.'
    },
    {
        id: 2,
        name: 'nexus.io',
        extension: '.io',
        category: 'tech',
        categoryDisplay: 'Technology',
        price: 200,
        description: 'A premium technology domain ideal for connectivity platforms, APIs, and software solutions.'
    },
    {
        id: 3,
        name: 'elevate.pro',
        extension: '.pro',
        category: 'business',
        categoryDisplay: 'Business',
        price: 180,
        description: 'Designed for professional services, consultancies, and enterprises looking to convey excellence.'
    },
    {
        id: 4,
        name: 'luminous.studio',
        extension: '.studio',
        category: 'creative',
        categoryDisplay: 'Creative',
        price: 160,
        description: 'Ideal for creative agencies, design studios, and digital media companies.'
    },
    {
        id: 5,
        name: 'venture.capital',
        extension: '.capital',
        category: 'business',
        categoryDisplay: 'Business',
        price: 250,
        description: 'Premium domain for investment firms, venture capitalists, and financial enterprises.'
    },
    {
        id: 6,
        name: 'horizon.digital',
        extension: '.digital',
        category: 'tech',
        categoryDisplay: 'Technology',
        price: 170,
        description: 'Perfect for digital transformation companies, digital agencies, and online platforms.'
    },
    {
        id: 7,
        name: 'apex.ventures',
        extension: '.ventures',
        category: 'business',
        categoryDisplay: 'Business',
        price: 190,
        description: 'Excellent for startup incubators, business ventures, and entrepreneurial initiatives.'
    },
    {
        id: 8,
        name: 'create.art',
        extension: '.art',
        category: 'creative',
        categoryDisplay: 'Creative',
        price: 140,
        description: 'Curated for artists, galleries, creative professionals, and artistic endeavors.'
    },
    {
        id: 9,
        name: 'enterprise.cloud',
        extension: '.cloud',
        category: 'enterprise',
        categoryDisplay: 'Enterprise',
        price: 220,
        description: 'For large-scale cloud computing, infrastructure, and enterprise solutions.'
    },
    {
        id: 10,
        name: 'synthesis.tech',
        extension: '.tech',
        category: 'tech',
        categoryDisplay: 'Technology',
        price: 165,
        description: 'A powerful domain for technology companies, software firms, and tech startups.'
    },
    {
        id: 11,
        name: 'catalyst.solutions',
        extension: '.solutions',
        category: 'business',
        categoryDisplay: 'Business',
        price: 175,
        description: 'Perfect for solution providers, consulting firms, and service organizations.'
    },
    {
        id: 12,
        name: 'spectrum.design',
        extension: '.design',
        category: 'creative',
        categoryDisplay: 'Creative',
        price: 155,
        description: 'An elegant domain for graphic designers, design studios, and creative services.'
    }
];

// ===== DOMAIN AVAILABILITY SEARCH =====
const popularTLDs = [
    { tld: '.com', description: 'Commercial', category: 'general', popular: true },
    { tld: '.net', description: 'Network', category: 'general', popular: true },
    { tld: '.org', description: 'Organization', category: 'general', popular: true },
    { tld: '.io', description: 'Input/Output (Tech)', category: 'tech', popular: true },
    { tld: '.co', description: 'Company', category: 'general', popular: true },
    { tld: '.app', description: 'Applications', category: 'tech', popular: true },
    { tld: '.dev', description: 'Developer', category: 'tech', popular: true },
    { tld: '.ai', description: 'Artificial Intelligence', category: 'tech', popular: true },
    { tld: '.tech', description: 'Technology', category: 'tech', popular: false },
    { tld: '.store', description: 'Online Store', category: 'business', popular: false },
    { tld: '.blog', description: 'Blogging', category: 'creative', popular: false },
    { tld: '.design', description: 'Design', category: 'creative', popular: false },
    { tld: '.cloud', description: 'Cloud Computing', category: 'tech', popular: false },
    { tld: '.digital', description: 'Digital', category: 'tech', popular: false },
    { tld: '.pro', description: 'Professional', category: 'business', popular: false },
    { tld: '.studio', description: 'Studio', category: 'creative', popular: false },
    { tld: '.capital', description: 'Capital', category: 'business', popular: false },
    { tld: '.solutions', description: 'Solutions', category: 'business', popular: false },
    { tld: '.ventures', description: 'Ventures', category: 'business', popular: false },
    { tld: '.art', description: 'Art', category: 'creative', popular: false }
];

// Simulated registered domains cache for demo
const simulatedRegisteredDomains = new Set();

// Seed some domains as "registered" for realism
const seedRegisteredDomains = () => {
    const seeds = [
        'google', 'facebook', 'amazon', 'apple', 'microsoft', 'netflix',
        'twitter', 'instagram', 'linkedin', 'youtube', 'whatsapp', 'tiktok',
        'spotify', 'dropbox', 'github', 'gitlab', 'reddit', 'pinterest',
        'adobe', 'oracle', 'ibm', 'intel', 'cisco', 'salesforce',
        'uber', 'airbnb', 'lyft', 'slack', 'zoom', 'stripe',
        'paypal', 'shopify', 'wordpress', 'medium', 'wikipedia', 'yahoo',
        'bing', 'baidu', 'alibaba', 'tesla', 'nvidia', 'amd',
        'samsung', 'nokia', 'sony', 'panasonic', 'dhl', 'fedex',
        'bloomberg', 'reuters', 'forbes', 'cnn', 'bbc', 'nytimes',
        'harvard', 'stanford', 'mit', 'oxford', 'cambridge', 'nasa',
        'sovereign', 'domains', 'certificate', 'registry'
    ];
    seeds.forEach(name => simulatedRegisteredDomains.add(name.toLowerCase()));
};
seedRegisteredDomains();

// Randomly determine if a domain is available (with some realism)
function isDomainAvailable(name, tld) {
    const fullName = (name + tld).toLowerCase();
    // Check against existing premium domains in our catalog
    const isPremiumListed = domains.some(d => d.name.toLowerCase() === fullName.toLowerCase());
    if (isPremiumListed) return 'premium';
    
    // Check simulated registered domains
    const nameOnly = name.toLowerCase().trim();
    if (simulatedRegisteredDomains.has(nameOnly)) return 'taken';
    
    // Short names (1-2 chars) are almost always taken
    if (nameOnly.length <= 2) return 'taken';
    
    // Random check for realism - most common TLDs have more taken domains
    const takenProbability = {
        '.com': 0.55, '.net': 0.40, '.org': 0.35, '.co': 0.30,
        '.io': 0.25, '.app': 0.20, '.dev': 0.20, '.ai': 0.15
    };
    const prob = takenProbability[tld] || 0.15;
    
    // Use a simple hash of the name+tld for deterministic results within a session
    let hash = 0;
    const str = nameOnly + tld;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    const normalizedHash = Math.abs(hash) / 2147483647;
    
    if (normalizedHash < prob) return 'taken';
    return 'available';
}

function getDomainPrice(tld) {
    const priceMap = {
        '.com': 12.99, '.net': 11.99, '.org': 10.99, '.co': 14.99,
        '.io': 34.99, '.app': 15.99, '.dev': 15.99, '.ai': 49.99,
        '.tech': 13.99, '.store': 19.99, '.blog': 13.99, '.design': 24.99,
        '.cloud': 16.99, '.digital': 17.99, '.pro': 14.99, '.studio': 21.99,
        '.capital': 29.99, '.solutions': 16.99, '.ventures': 24.99, '.art': 18.99
    };
    return priceMap[tld] || 14.99;
}

function checkDomainAvailability() {
    const input = document.getElementById('domainNameInput');
    const resultsDiv = document.getElementById('availabilityResults');
    const resultsList = document.getElementById('resultsList');
    const noResults = document.getElementById('noResultsMessage');
    const searchedNameSpan = document.getElementById('searchedDomainName');
    const resultsCount = document.getElementById('resultsCount');
    
    let name = input.value.trim().toLowerCase();
    
    // Clean the input - remove any TLD if accidentally typed
    popularTLDs.forEach(({ tld }) => {
        if (name.endsWith(tld)) {
            name = name.slice(0, -tld.length);
        }
    });
    
    // Remove protocol, www, etc.
    name = name.replace(/^(https?:\/\/)?(www\.)?/, '');
    
    if (!name) {
        input.style.borderColor = 'var(--crimson)';
        input.placeholder = 'Please enter a domain name...';
        setTimeout(() => {
            input.style.borderColor = '';
            input.placeholder = 'Enter your desired domain name...';
        }, 2000);
        return;
    }
    
    // Validate domain name (alphanumeric and hyphens only)
    if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(name) && !/^[a-z0-9]$/.test(name)) {
        showNotification('Domain names can only contain letters, numbers, and hyphens');
        return;
    }
    
    input.style.borderColor = 'var(--deep-gold)';
    searchedNameSpan.textContent = name;
    
    // Show loading state
    resultsList.innerHTML = `
        <div class="loading-results">
            <div class="spinner"></div>
            <p>Checking availability across ${popularTLDs.length} TLDs...</p>
        </div>
    `;
    resultsDiv.classList.remove('hidden');
    noResults.classList.add('hidden');
    
    // Simulate network delay for realism
    setTimeout(() => {
        let availableCount = 0;
        let premiumCount = 0;
        
        const results = popularTLDs.map(({ tld, description, category, popular }) => {
            const status = isDomainAvailable(name, tld);
            const price = getDomainPrice(tld);
            
            if (status === 'available') availableCount++;
            if (status === 'premium') premiumCount++;
            
            return { name, tld, description, category, popular, status, price };
        });
        
        // Sort: available first, then premium, then taken
        const statusOrder = { available: 0, premium: 1, taken: 2 };
        results.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        
        resultsCount.textContent = `${availableCount + premiumCount} available`;
        
        resultsList.innerHTML = results.map(r => {
            const statusConfig = {
                available: { class: 'status-available', label: 'Available', icon: '&#x2714;' },
                premium: { class: 'status-premium', label: 'Premium', icon: '&#x2B50;' },
                taken: { class: 'status-taken', label: 'Taken', icon: '&#x2716;' }
            };
            
            const cfg = statusConfig[r.status];
            const isClickable = r.status === 'available' || r.status === 'premium';
            
            return `
                <div class="result-item ${r.status} ${r.popular ? 'popular-tld' : ''}" 
                     ${isClickable ? `onclick="handleDomainResult('${r.name}', '${r.tld}', '${r.status}', ${r.price})"` : ''}
                     role="${isClickable ? 'button' : ''}"
                     tabindex="${isClickable ? '0' : ''}"
                     title="${isClickable ? 'Click to purchase this domain' : ''}">
                    <div class="result-tld-info">
                        <span class="result-tld">${r.tld}</span>
                        <span class="result-desc">${r.description}</span>
                        ${r.popular ? '<span class="popular-badge">Popular</span>' : ''}
                    </div>
                    <div class="result-status-group">
                        <span class="result-price">$${r.price.toFixed(2)}/yr</span>
                        <span class="result-status ${cfg.class}">
                            ${cfg.icon} ${cfg.label}
                        </span>
                    </div>
                    ${isClickable ? '<span class="result-select-hint">Click to purchase &rarr;</span>' : ''}
                </div>
            `;
        }).join('');
        
        input.style.borderColor = '';
    }, 600 + Math.random() * 400);
}

// Handle clicking on an available/premium domain result
function handleDomainResult(name, tld, status, price) {
    // Create a temporary domain-like object to pass through the purchase flow
    const tempDomain = {
        id: Date.now(),
        name: name + tld,
        extension: tld,
        category: 'tech',
        categoryDisplay: getCategoryDisplay(tld),
        price: price,
        description: `The domain ${name}${tld} — an excellent choice for your online presence.`
    };
    
    selectedDomain = tempDomain;
    selectedPackage = 'essential';
    
    document.getElementById('modalDomainName').textContent = tempDomain.name;
    document.getElementById('modalDomainDesc').textContent = tempDomain.description;
    document.getElementById('modalDomainExt').textContent = tempDomain.extension;
    document.getElementById('modalDomainCat').textContent = tempDomain.categoryDisplay;
    document.getElementById('modalDomainPrice').textContent = `$${tempDomain.price.toFixed(2)}`;
    
    updateTotalPrice();
    document.getElementById('domainModal').classList.remove('hidden');
}

function getCategoryDisplay(tld) {
    const tldInfo = popularTLDs.find(t => t.tld === tld);
    if (!tldInfo) return 'General';
    const categories = {
        general: 'General',
        tech: 'Technology',
        business: 'Business',
        creative: 'Creative'
    };
    return categories[tldInfo.category] || 'General';
}

// Enter key support for domain search
document.addEventListener('DOMContentLoaded', () => {
    const domainInput = document.getElementById('domainNameInput');
    if (domainInput) {
        domainInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkDomainAvailability();
            }
        });
    }
});

// Render TLD grid on page load
function renderTLDGrid() {
    const grid = document.getElementById('tldGrid');
    if (!grid) return;
    
    // Show popular TLDs first
    const sorted = [...popularTLDs].sort((a, b) => {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return 0;
    });
    
    grid.innerHTML = sorted.map(t => `
        <div class="tld-chip ${t.popular ? 'popular' : ''}" 
             onclick="selectTLD('${t.tld}')"
             title="${t.description} — ${t.popular ? 'Popular' : ''}">
            <span class="tld-text">${t.tld}</span>
            <span class="tld-category">${t.description}</span>
        </div>
    `).join('');
    
    // Auto-select first TLD
    if (sorted.length > 0) {
        selectTLD(sorted[0].tld);
    }
}

function selectTLD(tld) {
    // Update visual selection
    document.querySelectorAll('.tld-chip').forEach(chip => {
        chip.classList.toggle('selected', chip.querySelector('.tld-text')?.textContent === tld);
    });
    // Update preview suffix
    const preview = document.getElementById('selectedTldPreview');
    if (preview) preview.textContent = tld;
}

// Initialize TLD grid on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    renderTLDGrid();
});

const certificatePackages = {
    essential: { name: 'Essential', price: 9.99 },
    premium: { name: 'Premium', price: 24.99 },
    elite: { name: 'Elite', price: 49.99 }
};
const customizationFee = 4.99;
const frameFee = 10.00;
const baseDeliveryFee = 6.99;
const expeditedDeliveryFee = 12.99;

let selectedDomain = null;
let selectedPackage = 'essential';

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('certGenIssueDate').value = today;
    renderDomains(domains);
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('domainSearch').addEventListener('input', filterDomains);
    document.getElementById('categoryFilter').addEventListener('change', filterDomains);
    document.querySelectorAll('input[name="package"]').forEach(radio => {
        radio.addEventListener('change', updateTotalPrice);
    });

    const customizationBox = document.getElementById('certGenCustomization');
    const customizationDetails = document.getElementById('certGenCustomizationDetails');

    if (customizationBox) {
        customizationBox.addEventListener('change', () => {
            customizationDetails.classList.toggle('hidden', !customizationBox.checked);
            updateCertificateTotals();
        });
    }

    ['certGenAddressLine', 'certGenCity', 'certGenState', 'certGenPostal', 'certGenCountry'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateCertificateTotals);
        }
    });
}

// ===== DOMAIN RENDERING =====
function renderDomains(domainsToDisplay) {
    const grid = document.getElementById('domainsGrid');
    
    if (domainsToDisplay.length === 0) {
        grid.innerHTML = '<div class="no-results">No domains found matching your criteria.</div>';
        return;
    }

    grid.innerHTML = domainsToDisplay.map(domain => `
        <div class="domain-card" onclick="openDomainModal(${domain.id})">
            <div class="domain-name">${domain.name}</div>
            <div class="domain-category">${domain.categoryDisplay}</div>
            <p class="domain-price">$${domain.price}</p>
            <p class="domain-desc-short">${domain.description.substring(0, 80)}...</p>
            <button class="view-details-btn">View Details</button>
        </div>
    `).join('');
}

// ===== FILTERING =====
function filterDomains() {
    const searchTerm = document.getElementById('domainSearch').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;

    const filtered = domains.filter(domain => {
        const matchesSearch = domain.name.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || domain.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    renderDomains(filtered);
}

// ===== DOMAIN MODAL =====
function openDomainModal(domainId) {
    selectedDomain = domains.find(d => d.id === domainId);
    selectedPackage = 'essential';

    document.getElementById('modalDomainName').textContent = selectedDomain.name;
    document.getElementById('modalDomainDesc').textContent = selectedDomain.description;
    document.getElementById('modalDomainExt').textContent = selectedDomain.extension;
    document.getElementById('modalDomainCat').textContent = selectedDomain.categoryDisplay;
    document.getElementById('modalDomainPrice').textContent = `$${selectedDomain.price}`;

    updateTotalPrice();
    document.getElementById('domainModal').classList.remove('hidden');
}

function closeDomainModal() {
    document.getElementById('domainModal').classList.add('hidden');
}

function updateTotalPrice() {
    selectedPackage = document.querySelector('input[name="package"]:checked').value;
    const package = certificatePackages[selectedPackage];
    const total = selectedDomain.price + package.price;
    
    document.getElementById('modalTotalPrice').innerHTML = `
        <div class="price-breakdown">
            <div class="price-row">
                <span>Domain Registration:</span>
                <span>$${selectedDomain.price.toFixed(2)}</span>
            </div>
            <div class="price-row">
                <span>${package.name} Certificate:</span>
                <span>$${package.price.toFixed(2)}</span>
            </div>
            <div class="price-row total-row">
                <span>Total:</span>
                <span>$${total.toFixed(2)}</span>
            </div>
        </div>
    `;
}

// ===== DOMAIN PURCHASE =====
function purchaseDomain() {
    closeDomainModal();
    
    // Populate the certificate generation modal
    document.getElementById('certGenDomainName').value = selectedDomain.name;
    
    const package = certificatePackages[selectedPackage];
    const total = selectedDomain.price + package.price;
    
    document.getElementById('certGenOrderItems').innerHTML = `
        <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--deep-gold);">
            <span>Domain: ${selectedDomain.name}</span>
            <span style="font-weight: bold;">$${selectedDomain.price.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--deep-gold);">
            <span>${package.name} Certificate</span>
            <span style="font-weight: bold;">$${package.price.toFixed(2)}</span>
        </div>
    `;

    updateCertificateTotals();
    document.getElementById('certificateGenerationModal').classList.remove('hidden');
    showNotification(`${selectedDomain.name} added to checkout`);
}

function updateCertificateTotals() {
    const package = certificatePackages[selectedPackage];
    const subtotal = selectedDomain ? selectedDomain.price + package.price : package.price;
    const customizationEnabled = document.getElementById('certGenCustomization')?.checked || false;
    const frameEnabled = document.getElementById('certGenFrame')?.checked || false;
    const customizationCost = customizationEnabled ? customizationFee : 0;
    const frameCost = frameEnabled ? frameFee : 0;
    const deliveryCost = calculateCertGenDeliveryEstimate();
    const total = subtotal + customizationCost + frameCost + deliveryCost;

    document.getElementById('certGenSubtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('certGenUpgrade').textContent = `$${(customizationCost + frameCost).toFixed(2)}`;
    document.getElementById('certGenDeliveryEstimate').textContent = `$${deliveryCost.toFixed(2)}`;
    document.getElementById('certGenTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('certGenEstimate').textContent = `$${deliveryCost.toFixed(2)}`;
}

function calculateCertGenDeliveryEstimate() {
    const addressFields = [
        document.getElementById('certGenAddressLine')?.value || '',
        document.getElementById('certGenCity')?.value || '',
        document.getElementById('certGenState')?.value || '',
        document.getElementById('certGenPostal')?.value || '',
        document.getElementById('certGenCountry')?.value || ''
    ];
    const hasAddress = addressFields.some(value => value.trim().length > 0);

    if (!hasAddress) {
        return 0;
    }

    const country = (document.getElementById('certGenCountry')?.value || '').trim().toLowerCase();
    const isInternational = country && country !== 'usa' && country !== 'us' && country !== 'united states' && country !== 'united states of america';

    return isInternational ? expeditedDeliveryFee : baseDeliveryFee;
}

// ===== CERTIFICATE GENERATION FROM DOMAIN =====
function generateCertificateFromDomain() {
    const ownerName = document.getElementById('certGenOwnerName').value.trim();
    const domainName = document.getElementById('certGenDomainName').value.trim();
    const issueDate = document.getElementById('certGenIssueDate').value;
    const customNotes = document.getElementById('certGenNotes')?.value.trim() || '';
    const wantsCustomization = document.getElementById('certGenCustomization')?.checked || false;
    const wantsFrame = document.getElementById('certGenFrame')?.checked || false;
    const fontStyle = document.getElementById('certGenFont')?.value || 'Georgia';
    const primaryColor = document.getElementById('certGenPrimaryColor')?.value || '#C41E3A';
    const secondaryColor = document.getElementById('certGenSecondaryColor')?.value || '#B8860B';
    const borderStyle = document.getElementById('certGenBorderStyle')?.value || 'classic';

    if (!ownerName) {
        alert('Please enter the owner name');
        return;
    }
    if (!issueDate) {
        alert('Please select an issue date');
        return;
    }

    const date = new Date(issueDate);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const certificateHTML = generateCertificateHTML(ownerName, domainName, formattedDate, wantsCustomization, customNotes, { fontStyle, primaryColor, secondaryColor, borderStyle, wantsFrame });
    document.getElementById('certificatePreview').innerHTML = certificateHTML;
    
    closeCertificateGeneration();
    document.getElementById('certificateModal').classList.remove('hidden');
    
    showNotification('Certificate generated successfully');
}

// ===== CERTIFICATE HTML GENERATION =====
function generateCertificateHTML(ownerName, domainName, issueDate, wantsCustomization = false, customNotes = '', options = {}) {
    const { fontStyle = 'Georgia', primaryColor = '#C41E3A', secondaryColor = '#B8860B', borderStyle = 'classic', wantsFrame = false } = options;
    const customizationMarkup = wantsCustomization ? `<p class="cert-line" style="font-style: italic;">${escapeHtml(customNotes || 'Custom presentation upgrade included.')}</p>` : '';
    const frameMarkup = wantsFrame ? `<div style="margin-top: 1rem; padding: 0.75rem; border: 3px solid ${secondaryColor}; color: ${primaryColor}; font-weight: bold;">Framed presentation upgrade</div>` : '';

    return `
        <div class="certificate-header">
            <div class="certificate-seal">SEAL</div>
            <h1 class="certificate-title">CERTIFICATE OF DOMAIN OWNERSHIP</h1>
            <p class="certificate-subtitle">Sovereign Domains - Official Registry</p>
        </div>

        <div class="certificate-body">
            <p class="cert-line">This document certifies that</p>
            
            <div class="certificate-recipient">${escapeHtml(ownerName)}</div>
            
            <p class="cert-line">is the recognized and verified holder of the domain</p>
            
            <div class="certificate-domain">${escapeHtml(domainName)}</div>
            
            <p class="cert-line">This certificate attests to the legitimate ownership and registration of the aforementioned domain name, issued on this day as official proof of digital property rights.</p>
            ${customizationMarkup}
            ${frameMarkup}
        </div>

        <div class="certificate-footer">
            <div class="signature-line">
                <div style="height: 40px; border-top: 2px solid var(--slate); margin-bottom: 0.5rem;"></div>
                <p class="sig-label">Authorized Signature</p>
            </div>
            <div class="signature-line">
                <div style="height: 40px; border-top: 2px solid var(--slate); margin-bottom: 0.5rem;"></div>
                <p class="sig-label">Registry Official</p>
            </div>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
            <p class="certificate-date">Issued: <strong>${issueDate}</strong></p>
            <p class="certificate-date">Certificate ID: <strong>${generateCertificateID()}</strong></p>
            <p class="certificate-date" style="margin-top: 1.5rem; font-size: 0.8rem; opacity: 0.8;">
                This certificate is issued for commemorative and personal use. Sovereign Domains is a premium service for domain enthusiasts and professionals.
            </p>
        </div>
    `;
}

function generateCertificateID() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SD-${timestamp}-${random}`;
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

// ===== MODAL CONTROLS =====
function closeCertificateGeneration() {
    document.getElementById('certificateGenerationModal').classList.add('hidden');
}

function closeCertificate() {
    document.getElementById('certificateModal').classList.add('hidden');
}

// ===== CERTIFICATE DOWNLOAD =====
function downloadCertificate() {
    const certificateContent = document.getElementById('certificatePreview').innerHTML;
    const link = document.createElement('a');
    
    const filename = `Certificate_${new Date().getTime()}.html`;
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Domain Certificate</title>
    <style>
        body { font-family: Georgia, serif; background: white; }
        .certificate-header { text-align: center; }
        .certificate-seal { font-size: 1.8rem; font-weight: bold; color: #C41E3A; }
        .certificate-title { color: #C41E3A; font-size: 2rem; }
        .certificate-body { text-align: center; margin: 2rem 0; }
        .certificate-recipient { font-size: 1.8rem; font-weight: bold; margin: 2rem 0; border-bottom: 2px solid #2F4F4F; display: inline-block; padding-bottom: 0.5rem; }
        .certificate-domain { font-size: 1.6rem; color: #B8860B; font-weight: bold; margin: 1.5rem 0; }
    </style>
</head>
<body>
${certificateContent}
</body>
</html>`;
    
    const dataBlob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(dataBlob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// ===== NOTIFICATIONS =====
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--crimson);
        color: var(--ivory);
        padding: 1rem 1.5rem;
        border-radius: 0;
        border: 2px solid var(--deep-gold);
        font-size: 0.95rem;
        z-index: 2000;
        animation: slideInRight 0.3s ease;
        font-family: 'Georgia', serif;
        font-weight: bold;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ===== EVENT LISTENERS =====
document.addEventListener('click', (event) => {
    const domainModal = document.getElementById('domainModal');
    const certGenModal = document.getElementById('certificateGenerationModal');
    const certModal = document.getElementById('certificateModal');

    if (event.target === domainModal) {
        closeDomainModal();
    }
    if (event.target === certGenModal) {
        closeCertificateGeneration();
    }
    if (event.target === certModal) {
        closeCertificate();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeDomainModal();
        closeCertificateGeneration();
        closeCertificate();
    }
});

console.log('Sovereign Domains marketplace loaded successfully');
