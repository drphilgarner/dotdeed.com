// ============================================
// DOT DEED — Certificate Engine v2
// Prodigi-compatible 8×10 certificate rendering
// ============================================

// Theme presets
const CERT_THEMES = {
    classic: {
        name: 'Classic',
        icon: '📜',
        primaryColor: '#6B0B22',
        secondaryColor: '#D62828',
        awardTitle: 'Digital Domain Holder',
        fontFamily: 'Cormorant Garamond',
        description: 'The original DOT DEED certificate.',
    },
    birthday: {
        name: 'Birthday',
        icon: '🎂',
        primaryColor: '#1a56db',
        secondaryColor: '#3b82f6',
        awardTitle: 'Dominion Day Honoree',
        fontFamily: 'Cormorant Garamond',
        description: 'Celebrate a birthday with a domain gift.',
        showAge: true,
        ageLabel: 'Age',
    },
    babyshower: {
        name: 'Baby Shower',
        icon: '👶',
        primaryColor: '#059669',
        secondaryColor: '#34d399',
        awardTitle: 'Future Digital Pioneer',
        fontFamily: 'Cormorant Garamond',
        description: 'Reserve a domain for a little one.',
        showBabyName: true,
        babyNameLabel: 'Baby\'s Name (optional)',
    },
    anniversary: {
        name: 'Anniversary',
        icon: '💍',
        primaryColor: '#7c3aed',
        secondaryColor: '#a78bfa',
        awardTitle: 'Partnership Domain Award',
        fontFamily: 'Cormorant Garamond',
        description: 'Commemorate a special milestone.',
        showYears: true,
        yearsLabel: 'Years Together',
    },
    graduation: {
        name: 'Graduation',
        icon: '🎓',
        primaryColor: '#b45309',
        secondaryColor: '#f59e0b',
        awardTitle: 'Digital Scholar Award',
        fontFamily: 'Cormorant Garamond',
        description: 'Honor a graduate with their own domain.',
        showDegree: true,
        degreeLabel: 'Degree / Program',
    },
    business: {
        name: 'Business',
        icon: '💼',
        primaryColor: '#1e293b',
        secondaryColor: '#64748b',
        awardTitle: 'Digital Enterprise Certificate',
        fontFamily: 'Cormorant Garamond',
        description: 'Professional domain ownership certificate.',
        showCompany: true,
        companyLabel: 'Company Name',
    },
};

// Get current theme from state
function getCurrentTheme() {
    return CERT_THEMES[currentCertificate.theme] || CERT_THEMES['classic'];
}

// ============================================
// CERTIFICATE RENDERER
// ============================================
function renderCertificateV2(cert) {
    const formattedDate = formatDate(cert.issueDate);
    const isGift = currentCertificate.isGift || false;
    const theme = getCurrentTheme();
    const displayOption = (document.querySelector('input[name="displayOption"]:checked')?.value || 'frame');
    const hasFrame = displayOption === 'frame';
    const frameColor = document.getElementById('frameWoodType')?.value || 'black';
    
    // Colors from theme (or custom overrides if tier allows)
    const tier = cert.type;
    const isEssential = tier === 'Essential';
    const primaryColor = (!isEssential && document.getElementById('primaryColor')?.value) || theme.primaryColor;
    const secondaryColor = (!isEssential && document.getElementById('secondaryColor')?.value) || theme.secondaryColor;
    const fontFamily = (!isEssential && document.getElementById('fontStyle')?.value) || theme.fontFamily;
    
    // Award title
    const awardTitle = (!isEssential && document.getElementById('awardTitle')?.value) || theme.awardTitle;
    
    // Theme-specific fields
    let themeFields = '';
    const age = document.getElementById('themeAge')?.value;
    const babyName = document.getElementById('themeBabyName')?.value;
    const yearsTogether = document.getElementById('themeYears')?.value;
    const degree = document.getElementById('themeDegree')?.value;
    const companyName = document.getElementById('themeCompany')?.value;
    
    if (theme.showAge && age) {
        themeFields = `<div style="text-align:center;margin-top:0.3rem;font-size:0.7rem;color:${primaryColor};font-weight:600;">Celebrating ${escapeHtml(age)} ${parseInt(age) === 1 ? 'year' : 'years'}</div>`;
    } else if (theme.showBabyName && babyName) {
        themeFields = `<div style="text-align:center;margin-top:0.3rem;font-size:0.7rem;color:${primaryColor};font-weight:600;">Welcoming ${escapeHtml(babyName)}</div>`;
    } else if (theme.showYears && yearsTogether) {
        themeFields = `<div style="text-align:center;margin-top:0.3rem;font-size:0.7rem;color:${primaryColor};font-weight:600;">${escapeHtml(yearsTogether)} ${parseInt(yearsTogether) === 1 ? 'year' : 'years'} together</div>`;
    } else if (theme.showDegree && degree) {
        themeFields = `<div style="text-align:center;margin-top:0.3rem;font-size:0.7rem;color:${primaryColor};font-weight:600;">${escapeHtml(degree)}</div>`;
    } else if (theme.showCompany && companyName) {
        themeFields = `<div style="text-align:center;margin-top:0.3rem;font-size:0.7rem;color:${primaryColor};font-weight:600;">${escapeHtml(companyName)}</div>`;
    }
    
    // Smart text scaling
    const nameLen = (cert.recipientName || '').length;
    const nameSize = nameLen > 30 ? '0.9rem' : nameLen > 20 ? '1.05rem' : '1.2rem';
    const awardLen = awardTitle.length;
    const awardSize = awardLen > 35 ? '0.6rem' : awardLen > 25 ? '0.7rem' : '0.8rem';
    
    // Domain info
    const domainInfo = cert.domainName && cert.domainName !== '[domain.com]' ? cert.domainName.toLowerCase() : '';
    const domainYearsText = cert.domainPrice > 0 ? ` · ${cert.domainYears} ${cert.domainYears === 1 ? 'year' : 'years'}` : '';
    
    // Recipient label
    const recipientLabel = isGift ? 'Gift for' : 'Presented to';
    const giftPrefix = isGift ? `<div style="font-size:0.4rem;color:${primaryColor}88;letter-spacing:1px;margin-bottom:0.1rem;">${recipientLabel}</div>` : '';
    
    // QR code — always show placeholder if domain exists, real QR if claim exists
    const qrCode = domainInfo ? (
        cert.claimToken
        ? `<div style="display:flex;align-items:center;gap:0.25rem;">
            <img src="${getQRDataUrl(cert.claimUrl || '')}" alt="QR" style="width:22px;height:22px;border-radius:2px;">
            <div style="font-size:0.38rem;color:${primaryColor}66;line-height:1.2;">Claim<br>domain</div>
           </div>`
        : `<div style="display:flex;align-items:center;gap:0.25rem;">
            <div style="width:22px;height:22px;border:1px dashed ${primaryColor}40;border-radius:2px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:0.45rem;color:${primaryColor}40;">QR</span>
            </div>
            <div style="font-size:0.38rem;color:${primaryColor}66;line-height:1.2;">Claim<br>domain</div>
           </div>`
    ) : '';
    
    // Build the certificate HTML
    const certHTML = `
    <div style="position:relative;width:100%;height:100%;background:#ffffff;font-family:'${fontFamily}',Georgia,serif;padding:1.2rem 1rem 0.8rem;">
        
        <!-- Top decorative bar -->
        <div style="height:2px;background:linear-gradient(90deg,transparent,${primaryColor},${secondaryColor},${primaryColor},transparent);margin-bottom:0.5rem;"></div>
        
        <!-- Brand -->
        <div style="text-align:center;margin-bottom:0.2rem;">
            <div style="font-size:0.95rem;font-weight:700;letter-spacing:3px;color:${primaryColor};">DOT DEED</div>
            <div style="font-size:0.45rem;color:${secondaryColor};letter-spacing:2px;text-transform:uppercase;">Registry of Digital Estates</div>
        </div>
        
        <!-- Motto -->
        <div style="text-align:center;font-size:0.42rem;color:${primaryColor}60;letter-spacing:2px;margin-bottom:0.3rem;font-style:italic;">Veritas · Digitalis · Honor</div>
        
        <!-- Thin divider -->
        <div style="display:flex;align-items:center;gap:0.4rem;margin:0 1.5rem 0.4rem;">
            <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,${primaryColor}40);"></div>
            <span style="color:${primaryColor}60;font-size:0.5rem;">✦</span>
            <div style="flex:1;height:1px;background:linear-gradient(90deg,${primaryColor}40,transparent);"></div>
        </div>
        
        <!-- Certifies that -->
        <div style="text-align:center;font-size:0.48rem;color:${primaryColor}99;letter-spacing:1px;margin-bottom:0.2rem;">By the authority vested in the Registry, it is hereby certified that</div>
        
        <!-- Recipient name -->
        ${giftPrefix}
        <div style="text-align:center;font-size:${nameSize};font-weight:700;color:${primaryColor};margin-bottom:0.15rem;letter-spacing:1px;">
            ${escapeHtml(cert.recipientName || '[Name]')}
        </div>
        
        <!-- Granted title -->
        <div style="text-align:center;font-size:0.43rem;color:${primaryColor}88;letter-spacing:1px;margin-bottom:0.2rem;">having demonstrated rightful stewardship, is granted the title of</div>
        
        <!-- Award -->
        <div style="text-align:center;margin:0.15rem 2rem;padding:0.15rem 0;border-top:1px solid ${primaryColor}30;border-bottom:1px solid ${primaryColor}30;">
            <span style="font-size:${awardSize};font-weight:700;color:${primaryColor};letter-spacing:1px;">${escapeHtml(awardTitle)}</span>
        </div>
        
        ${themeFields}
        
        <!-- Domain -->
        ${domainInfo ? `
        <div style="text-align:center;margin:0.3rem 0 0.15rem;">
            <div style="font-size:0.4rem;color:${primaryColor}88;letter-spacing:1px;margin-bottom:0.08rem;">Network Namespace</div>
            <div style="display:inline-block;padding:0.1rem 0.8rem;background:${primaryColor};color:#fff;font-size:0.68rem;font-weight:600;letter-spacing:0.5px;border-radius:3px;">${domainInfo}</div>
            ${domainYearsText ? `<div style="font-size:0.38rem;color:${primaryColor}66;margin-top:0.06rem;">Registered for${domainYearsText}</div>` : ''}
        </div>` : ''}
        
        <!-- Custom notes -->
        ${(!isEssential && document.getElementById('upgradeNotes')?.value) ? `
        <div style="text-align:center;font-size:0.45rem;color:${primaryColor}99;font-style:italic;margin:0.1rem 1.5rem;line-height:1.3;">${escapeHtml(document.getElementById('upgradeNotes').value)}</div>` : ''}
        
        <!-- Signature row -->
        <div style="display:flex;align-items:center;justify-content:center;gap:1rem;margin:0.35rem 0 0.2rem;">
            <div style="text-align:center;flex:1;max-width:80px;">
                <div style="height:1px;background:${primaryColor};margin-bottom:0.1rem;"></div>
                <div style="font-size:0.42rem;color:${primaryColor};font-weight:600;letter-spacing:1px;">Registrar</div>
            </div>
            <!-- Seal -->
            <svg viewBox="0 0 60 60" style="width:40px;height:40px;">
                <circle cx="30" cy="30" r="27" fill="${primaryColor}08" stroke="${primaryColor}" stroke-width="1.2"/>
                <circle cx="30" cy="30" r="23" fill="none" stroke="${secondaryColor}" stroke-width="0.7" stroke-dasharray="2 2"/>
                <path d="M22 30 L30 22 L38 30 L30 38 Z" fill="${primaryColor}18" stroke="${primaryColor}" stroke-width="0.8"/>
                <text x="30" y="33" text-anchor="middle" font-size="8" font-weight="bold" fill="${primaryColor}" font-family="serif">DD</text>
            </svg>
            <div style="text-align:center;flex:1;max-width:80px;">
                <div style="height:1px;background:${primaryColor};margin-bottom:0.1rem;"></div>
                <div style="font-size:0.42rem;color:${primaryColor};font-weight:600;letter-spacing:1px;">Chancellor</div>
            </div>
        </div>
        
        <!-- Bottom bar -->
        <div style="height:1px;background:linear-gradient(90deg,transparent,${primaryColor}30,transparent);margin:0 1rem 0.2rem;"></div>
        
        <!-- Footer -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0.5rem;">
            <div style="font-size:0.38rem;color:${primaryColor}88;">Issued ${formattedDate}</div>
            <div style="font-size:0.38rem;color:${primaryColor}88;">No. ${cert.registryId}</div>
            ${qrCode}
        </div>
        
        <!-- Bottom decorative bar -->
        <div style="height:1.5px;background:linear-gradient(90deg,transparent,${primaryColor},${secondaryColor},${primaryColor},transparent);margin-top:0.3rem;"></div>
        
        <!-- Corner ornaments -->
        <div style="position:absolute;top:0.5rem;left:0.5rem;width:10px;height:10px;border-top:1px solid ${primaryColor}20;border-left:1px solid ${primaryColor}20;"></div>
        <div style="position:absolute;top:0.5rem;right:0.5rem;width:10px;height:10px;border-top:1px solid ${primaryColor}20;border-right:1px solid ${primaryColor}20;"></div>
        <div style="position:absolute;bottom:0.5rem;left:0.5rem;width:10px;height:10px;border-bottom:1px solid ${primaryColor}20;border-left:1px solid ${primaryColor}20;"></div>
        <div style="position:absolute;bottom:0.5rem;right:0.5rem;width:10px;height:10px;border-bottom:1px solid ${primaryColor}20;border-right:1px solid ${primaryColor}20;"></div>
    </div>`;
    
    return certHTML;
}

// ============================================
// STUDIO CONTROLLER
// ============================================
let currentTheme = 'classic';

function applyTheme(themeKey) {
    currentTheme = themeKey;
    currentCertificate.theme = themeKey;
    const theme = CERT_THEMES[themeKey];
    
    // Highlight the selected theme
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    const card = document.querySelector(`.theme-card[data-theme="${themeKey}"]`);
    if (card) card.classList.add('active');
    
    // Show/hide theme-specific fields
    document.getElementById('themeAgeField').classList.toggle('hidden', !theme.showAge);
    document.getElementById('themeBabyField').classList.toggle('hidden', !theme.showBabyName);
    document.getElementById('themeYearsField').classList.toggle('hidden', !theme.showYears);
    document.getElementById('themeDegreeField').classList.toggle('hidden', !theme.showDegree);
    document.getElementById('themeCompanyField').classList.toggle('hidden', !theme.showCompany);
    
    updatePreview();
    queueBackgroundRender();
}

// Make globally accessible
window.applyTheme = applyTheme;
