// ===== CART MANAGEMENT =====
let cart = [];
const customizationFee = 4.99;
const frameFee = 10.00;
const baseDeliveryFee = 6.99;
const expeditedDeliveryFee = 12.99;

// Cached DOM references for checkout (populated on DOMContentLoaded)
let checkoutRefs = {};

function cacheCheckoutRefs() {
    checkoutRefs = {
        subtotal: document.getElementById('subtotal'),
        total: document.getElementById('total'),
        checkoutSubtotal: document.getElementById('checkoutSubtotal'),
        checkoutUpgrade: document.getElementById('checkoutUpgrade'),
        deliveryEstimateSummary: document.getElementById('deliveryEstimateSummary'),
        checkoutTotal: document.getElementById('checkoutTotal'),
        deliveryEstimate: document.getElementById('deliveryEstimate'),
        customizationBox: document.getElementById('certificateCustomization'),
        customizationDetails: document.getElementById('customizationDetails'),
        frameBox: document.getElementById('certificateFrame'),
        deliveryAddressLine: document.getElementById('deliveryAddressLine'),
        deliveryCity: document.getElementById('deliveryCity'),
        deliveryState: document.getElementById('deliveryState'),
        deliveryPostal: document.getElementById('deliveryPostal'),
        deliveryCountry: document.getElementById('deliveryCountry')
    };
}

// Set today's date as default
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issueDate').value = today;
    cacheCheckoutRefs();
    setupCheckoutListeners();
});

function setupCheckoutListeners() {
    const { customizationBox, customizationDetails } = checkoutRefs;

    if (customizationBox) {
        customizationBox.addEventListener('change', () => {
            customizationDetails.classList.toggle('hidden', !customizationBox.checked);
            updateCheckoutTotals();
        });
    }

    ['deliveryAddressLine', 'deliveryCity', 'deliveryState', 'deliveryPostal', 'deliveryCountry'].forEach(id => {
        const element = checkoutRefs[id];
        if (element) {
            element.addEventListener('input', updateCheckoutTotals);
        }
    });
}

function addToCart(packageName, price) {
    cart.push({
        id: Date.now(),
        name: packageName,
        price: price
    });
    updateCartUI();
    showNotification(`${packageName} package added to cart!`);
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCartUI();
    renderCartItems();
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    cartCount.textContent = cart.length;
    renderCartItems();
}

function renderCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        document.getElementById('subtotal').textContent = '$0.00';
        document.getElementById('total').textContent = '$0.00';
        return;
    }

    const itemsHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name} Certificate Package</div>
                <div class="cart-item-price">$${item.price.toFixed(2)}</div>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${item.id})">Remove</button>
        </div>
    `).join('');

    cartItemsContainer.innerHTML = itemsHTML;
    
    // Calculate totals
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('subtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

function renderCheckoutSummary() {
    const checkoutOrderItems = document.getElementById('checkoutOrderItems');
    
    if (cart.length === 0) {
        checkoutOrderItems.innerHTML = '<p class="empty-cart">No items in cart</p>';
        return;
    }

    const itemsHTML = cart.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--deep-gold);">
            <span>${item.name}</span>
            <span style="font-weight: bold; color: var(--crimson);">$${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    checkoutOrderItems.innerHTML = itemsHTML;
    updateCheckoutTotals();
}

function updateCheckoutTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    const customizationEnabled = checkoutRefs.customizationBox?.checked || false;
    const frameEnabled = checkoutRefs.frameBox?.checked || false;
    const customizationCost = customizationEnabled ? customizationFee : 0;
    const frameCost = frameEnabled ? frameFee : 0;
    const deliveryCost = calculateDeliveryEstimate();
    const total = subtotal + customizationCost + frameCost + deliveryCost;

    checkoutRefs.checkoutSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    checkoutRefs.checkoutUpgrade.textContent = `$${(customizationCost + frameCost).toFixed(2)}`;
    checkoutRefs.deliveryEstimateSummary.textContent = `$${deliveryCost.toFixed(2)}`;
    checkoutRefs.checkoutTotal.textContent = `$${total.toFixed(2)}`;
    checkoutRefs.deliveryEstimate.textContent = `$${deliveryCost.toFixed(2)}`;
}

function calculateDeliveryEstimate() {
    const addressFields = [
        checkoutRefs.deliveryAddressLine?.value || '',
        checkoutRefs.deliveryCity?.value || '',
        checkoutRefs.deliveryState?.value || '',
        checkoutRefs.deliveryPostal?.value || '',
        checkoutRefs.deliveryCountry?.value || ''
    ];
    const hasAddress = addressFields.some(value => value.trim().length > 0);

    if (!hasAddress) {
        return 0;
    }

    const country = (checkoutRefs.deliveryCountry?.value || '').trim().toLowerCase();
    const isInternational = country && country !== 'usa' && country !== 'us' && country !== 'united states' && country !== 'united states of america';

    return isInternational ? expeditedDeliveryFee : baseDeliveryFee;
}

// ===== MODAL CONTROLS =====
function openCart() {
    document.getElementById('cartModal').classList.remove('hidden');
    renderCartItems();
}

function closeCart() {
    document.getElementById('cartModal').classList.add('hidden');
}

function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Please add at least one package to your cart!');
        return;
    }
    
    closeCart();
    document.getElementById('checkoutModal').classList.remove('hidden');
    renderCheckoutSummary();
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.add('hidden');
}

function closeCertificate() {
    document.getElementById('certificateModal').classList.add('hidden');
}

// ===== CERTIFICATE GENERATION =====
function generateCertificate() {
    const ownerName = document.getElementById('ownerName').value.trim();
    const domainName = document.getElementById('domainName').value.trim();
    const issueDate = document.getElementById('issueDate').value;
    const customNotes = document.getElementById('certificateNotes')?.value.trim() || '';
    const wantsCustomization = document.getElementById('certificateCustomization')?.checked || false;
    const wantsFrame = document.getElementById('certificateFrame')?.checked || false;
    const fontStyle = document.getElementById('certificateFont')?.value || 'Georgia';
    const primaryColor = document.getElementById('certificatePrimaryColor')?.value || '#C41E3A';
    const secondaryColor = document.getElementById('certificateSecondaryColor')?.value || '#B8860B';
    const borderStyle = document.getElementById('certificateBorderStyle')?.value || 'classic';

    // Validation
    if (!ownerName) {
        alert('Please enter the owner\'s name');
        return;
    }
    if (!domainName) {
        alert('Please enter the domain name');
        return;
    }
    if (!issueDate) {
        alert('Please select an issue date');
        return;
    }

    // Format the date
    const date = new Date(issueDate);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Generate certificate HTML
    const certificateHTML = generateCertificateHTML(ownerName, domainName, formattedDate, wantsCustomization, customNotes, { fontStyle, primaryColor, secondaryColor, borderStyle, wantsFrame });
    
    // Display in modal
    document.getElementById('certificatePreview').innerHTML = certificateHTML;
    closeCheckout();
    document.getElementById('certificateModal').classList.remove('hidden');
    
    // Clear cart after successful generation
    cart = [];
    updateCartUI();
}

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
                This certificate is issued for commemorative and personal use. Sovereign Domains is a premium service for domain enthusiasts.
            </p>
        </div>
    `;
}

function generateCertificateID() {
    // Generate a unique certificate ID
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

// ===== EVENT LISTENERS =====
document.getElementById('cartBtn').addEventListener('click', openCart);

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const certificateModal = document.getElementById('certificateModal');

    if (event.target === cartModal) {
        closeCart();
    }
    if (event.target === checkoutModal) {
        closeCheckout();
    }
    if (event.target === certificateModal) {
        closeCertificate();
    }
});

// Keyboard support
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeCart();
        closeCheckout();
        closeCertificate();
    }
});

// ===== NOTIFICATIONS =====
function showNotification(message) {
    // Create notification element
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

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ===== CERTIFICATE DOWNLOAD =====
function downloadCertificate() {
    const certificateContent = document.getElementById('certificatePreview').innerHTML;
    const canvas = document.createElement('canvas');
    const doc = new jsPDF('p', 'mm', 'letter');
    
    // Simple text-based download as alternative
    const link = document.createElement('a');
    const element = document.createElement('div');
    element.innerHTML = certificateContent;
    
    const filename = `Certificate_${new Date().getTime()}.html`;
    const dataStr = documentElement.outerHTML;
    const dataBlob = new Blob([dataStr], {type: 'text/html'});
    const url = URL.createObjectURL(dataBlob);
    link.href = url;
    link.download = filename;
    link.click();
}

// Log initialization
console.log('Sovereign Domains marketplace loaded successfully!');
