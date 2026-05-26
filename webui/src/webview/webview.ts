import './webview.scss'

const MIN_ANDROID_WEBVIEW_VERSION = 120
export const UPDATE_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview'

interface NavigatorUAData {
  readonly brands: ReadonlyArray<{ readonly brand: string; readonly version: string }>
}

export function getWebviewVersion(): number | null {
  const brands = (navigator as Navigator & { readonly userAgentData?: NavigatorUAData }).userAgentData?.brands
  if (Array.isArray(brands) && brands.length > 0) {
    const androidWebViewBrand = brands.find((entry) => entry.brand === 'Android WebView')
    if (androidWebViewBrand) return Number.parseInt(androidWebViewBrand.version, 10)
  }

  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isWebView = /\bwv\b/.test(ua)
  if (isAndroid && isWebView) {
    const match = ua.match(/Chrome\/(\d+)/)
    return match ? Number.parseInt(match[1], 10) : 0
  }

  return null
}

export function isSupported(): boolean {
  const version = getWebviewVersion()
  return version === null || version >= MIN_ANDROID_WEBVIEW_VERSION
}

export function renderBlockingPage(): string {
  return /* html */ `
    <div class="webview">
      <p>Current WebView version is too low for this WebUI to work properly</p>
      <button id="update-webview" class="webview-button">UPDATE</button>
      <p class="webview-note">Please update Android System WebView to proceed</p>
    </div>
  `
}
