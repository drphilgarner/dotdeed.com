(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.CertificateCustomization = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function normalizeTier(tier) {
        return String(tier || 'essential').toLowerCase();
    }

    function getTierCapabilities(tier) {
        const normalized = normalizeTier(tier);

        if (normalized === 'elite') {
            return {
                canChangeFont: true,
                canChangePrimaryColor: true,
                canChangeSecondaryColor: true,
                canChangeAccentLine: true,
                canChangeBorderStyle: true,
                canUseWatermark: true,
                canUseSignatureStyle: true,
                label: 'Elite'
            };
        }

        if (normalized === 'premium') {
            return {
                canChangeFont: true,
                canChangePrimaryColor: true,
                canChangeSecondaryColor: true,
                canChangeAccentLine: true,
                canChangeBorderStyle: false,
                canUseWatermark: false,
                canUseSignatureStyle: false,
                label: 'Premium'
            };
        }

        return {
            canChangeFont: true,
            canChangePrimaryColor: true,
            canChangeSecondaryColor: false,
            canChangeAccentLine: false,
            canChangeBorderStyle: false,
            canUseWatermark: false,
            canUseSignatureStyle: false,
            label: 'Essential'
        };
    }

    function calculateCustomizationCost({ includeCustomization = false, includeFrame = false } = {}) {
        let total = 0;
        if (includeCustomization) {
            total += 4.99;
        }
        if (includeFrame) {
            total += 10;
        }
        return total;
    }

    return {
        getTierCapabilities,
        calculateCustomizationCost,
        normalizeTier
    };
});
