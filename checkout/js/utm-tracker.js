/**
 * Sistema de Captura e Exibição de UTM Parameters
 * Captura UTMs da URL e armazena no localStorage para uso em todas as páginas
 */

class UTMTracker {
    constructor() {
        this.utmKeys = ['utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'utm_id'];
        this.clickIdKeys = ['fbclid', 'gclid', 'ttclid', 'msclkid', 'sck', 'xcod'];
        this.allTrackingKeys = [...this.utmKeys, ...this.clickIdKeys];
        this.storageKey = 'utm_tracking';
        this.init();
    }

    init() {
        this.captureUTMs();
        this.ensureURLHasStoredTracking();
        this.decorateAllLinks();
        this.logUTMs();
        this.observeDOMForNewLinks();
    }

    captureUTMs() {
        const urlParams = new URLSearchParams(window.location.search);
        const currentUTMs = this.getStoredUTMs() || {};
        let hasNewUTMs = false;

        this.allTrackingKeys.forEach(key => {
            const value = urlParams.get(key);
            if (value && value.trim() !== '') {
                currentUTMs[key] = decodeURIComponent(value.trim());
                hasNewUTMs = true;
            }
        });

        if (hasNewUTMs) {
            currentUTMs.captured_at = new Date().toISOString();
            currentUTMs.page_captured = window.location.pathname;
            this.storeUTMs(currentUTMs);
            console.log('UTM Parameters capturados:', currentUTMs);
        }
    }

    storeUTMs(utms) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(utms));
        } catch (error) {
            console.error('Erro ao armazenar UTMs:', error);
        }
    }

    getStoredUTMs() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Erro ao recuperar UTMs:', error);
            return null;
        }
    }

    getUTMsForAPI() {
        const utms = this.getStoredUTMs();
        if (!utms) return {};

        const utmPayload = {};
        this.allTrackingKeys.forEach(key => {
            if (utms[key] && utms[key].trim() !== '') {
                utmPayload[key] = utms[key].substring(0, 255);
            }
        });
        return utmPayload;
    }

    appendTrackingParamsToUrl(rawUrl) {
        if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) {
            return rawUrl;
        }

        try {
            const target = new URL(rawUrl, window.location.origin);
            const tracking = this.getUTMsForAPI();

            Object.entries(tracking).forEach(([key, value]) => {
                if (!target.searchParams.has(key) && value) {
                    target.searchParams.set(key, value);
                }
            });

            if (target.origin === window.location.origin) {
                return `${target.pathname}${target.search}${target.hash}`;
            }
            return target.toString();
        } catch (error) {
            return rawUrl;
        }
    }

    ensureURLHasStoredTracking() {
        const tracking = this.getUTMsForAPI();
        if (!tracking || Object.keys(tracking).length === 0) return;

        const current = new URL(window.location.href);
        let changed = false;

        Object.entries(tracking).forEach(([key, value]) => {
            if (!current.searchParams.has(key) && value) {
                current.searchParams.set(key, value);
                changed = true;
            }
        });

        if (changed) {
            window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
        }
    }

    decorateAllLinks() {
        document.querySelectorAll('a[href]').forEach((anchor) => {
            const href = anchor.getAttribute('href');
            if (!href) return;
            anchor.setAttribute('href', this.appendTrackingParamsToUrl(href));
        });
    }

    observeDOMForNewLinks() {
        if (!('MutationObserver' in window)) return;

        const observer = new MutationObserver(() => {
            this.decorateAllLinks();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    logUTMs() {
        const utms = this.getStoredUTMs();
        if (!utms || Object.keys(utms).length === 0) {
            console.log('📊 UTM Tracker: Nenhum parâmetro UTM detectado');
            return;
        }
        console.group('📊 Parâmetros de Rastreamento UTM');
        this.utmKeys.forEach(key => {
            if (utms[key]) {
                const displayKey = key.replace('utm_', '').toUpperCase();
                console.log(`${displayKey}:`, utms[key]);
            }
        });
        if (utms.captured_at) {
            console.log('CAPTURADO EM:', new Date(utms.captured_at).toLocaleString('pt-BR'));
        }
        if (utms.page_captured) {
            console.log('PÁGINA:', utms.page_captured);
        }
        console.groupEnd();
    }

    clearUTMs() {
        localStorage.removeItem(this.storageKey);
        console.log('📊 UTM Tracker: Parâmetros UTM limpos');
    }

    getDebugInfo() {
        return {
            stored_utms: this.getStoredUTMs(),
            current_url: window.location.href,
            current_params: Object.fromEntries(new URLSearchParams(window.location.search)),
            api_payload: this.getUTMsForAPI()
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.utmTracker = new UTMTracker();
    });
} else {
    window.utmTracker = new UTMTracker();
}

window.getUTMsForAPI = () => {
    return window.utmTracker ? window.utmTracker.getUTMsForAPI() : {};
};

window.appendTrackingParams = (url) => {
    if (!window.utmTracker) return url;
    return window.utmTracker.appendTrackingParamsToUrl(url);
};

window.clearUTMs = () => {
    if (window.utmTracker) {
        window.utmTracker.clearUTMs();
    }
};

window.debugUTMs = () => {
    if (window.utmTracker) {
        console.log('UTM Debug Info:', window.utmTracker.getDebugInfo());
        return window.utmTracker.getDebugInfo();
    }
    return null;
};