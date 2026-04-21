const MIN_ANDROID_WEBVIEW_VERSION = 120;
export const UPDATE_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview';

function getWebviewVersion() {
    const brands = navigator.userAgentData?.brands;
    if (Array.isArray(brands) && brands.length > 0) {
        const androidWebViewBrand = brands.find((entry) => entry.brand === 'Android WebView');
        if (androidWebViewBrand) return Number.parseInt(androidWebViewBrand.version, 10);
    }

    // Legacy
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isWebView = /\bwv\b/.test(ua);
    if (isAndroid && isWebView) {
        const match = ua.match(/Chrome\/(\d+)/);
        return match ? Number.parseInt(match[1], 10) : 0;
    }

    return null;
}

export function isSupported() {
    const version = getWebviewVersion();
    return version === null || version >= MIN_ANDROID_WEBVIEW_VERSION;
}
