// ==============================================================
// GLOBAL PRODUCTION CONFIGURATION & RUNTIME ENVIRONMENT DETECTOR
// ==============================================================

// Set your deployed Render backend URL here:
// When deployed on Vercel, the frontend automatically connects to this backend.
// When running locally (localhost / 127.0.0.1), it automatically connects to http://127.0.0.1:8000.
const DEFAULT_PRODUCTION_BACKEND = "https://smart-query-backend-8ggr.onrender.com";

function getBackendBaseUrl() {
    // 1. Explicit window override (e.g. from test suite)
    if (window.CUSTOM_API_BASE) {
        return window.CUSTOM_API_BASE.replace(/\/+$/, "");
    }
    // 2. LocalStorage override (allows developer/admin to test with any backend URL from console!)
    try {
        const stored = localStorage.getItem("API_BACKEND_URL");
        if (stored && stored.trim()) {
            return stored.trim().replace(/\/+$/, "");
        }
    } catch (e) {}

    // 3. Environment detection:
    const host = window.location.hostname || "";
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "" || window.location.protocol === "file:";
    if (isLocal) {
        return "http://127.0.0.1:8000";
    }

    // 4. Production Cloud URL
    return DEFAULT_PRODUCTION_BACKEND;
}

function getApiUrl(subpath = "") {
    const base = getBackendBaseUrl();
    const cleanSub = (subpath || "").replace(/^\/+/, "").replace(/\/+$/, "");
    if (!cleanSub) {
        return `${base}/api`;
    }
    return `${base}/api/${cleanSub}`;
}

// Universal Global Exports
window.getBackendBaseUrl = getBackendBaseUrl;
window.getApiUrl = getApiUrl;
window.API_BASE = getApiUrl();
window.API_BASE_URL = getApiUrl("admin");
window.API_BASE_URL_QUERY = getApiUrl();
window.ANNOUNCEMENTS_API_URL = getApiUrl("announcements");

// Shared Universal HTML Sanitizer (Anti-XSS Protection)
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Global UI Button State Manager
async function setGlobalLoading(isLoading) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = isLoading;
        if (isLoading) {
            button.classList.add('opacity-95', 'cursor-not-allowed');
        } else {
            button.classList.remove('opacity-95', 'cursor-not-allowed');
        }
    });
}
window.setGlobalLoading = setGlobalLoading;
