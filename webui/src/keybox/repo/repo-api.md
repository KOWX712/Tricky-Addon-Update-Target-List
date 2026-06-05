# Keybox Repository — Iframe Integration API (For Self-Hosted Repo Sites)

This document describes the `postMessage` protocol that a self-hosted Keybox Repository website must implement in order to be embeddable as an iframe in Tricky Addon's settings page.

If you are **forking this project** and want to build your own Keybox Repository website, this is the contract your frontend must follow. Everything beyond the protocol section is optional — just suggestions to help you get started.

---

## Protocol (The Only Hard Requirement)

The entire integration boils down to **three postMessage messages**. Implement these on your repo website and it will work with Tricky Addon.

### 1. Handshake

When your site is loaded inside the iframe, Tricky Addon starts sending this message repeatedly every 500ms:

```
Parent → Your Iframe
{ "type": "handshake" }
```

Your site **must** reply once to establish the channel:

```
Your Iframe → Parent
{ "type": "handshake_ack" }
```

**Why this matters:** You must capture `event.origin` from the incoming handshake and use it as `targetOrigin` in all your outgoing `postMessage` calls. Without this, your messages go nowhere — `postMessage` with a `targetOrigin` of `*` would leak download URLs to any listening window.

### 2. Download

When a user picks a keybox in iframe mode, send the download URL to the parent:

```
Your Iframe → Parent
{ "type": "download", "url": "<absolute URL to the keybox content>" }
```

| Field  | Type     | Description                                  |
|--------|----------|----------------------------------------------|
| `type` | `string` | Always `"download"`                          |
| `url`  | `string` | Absolute URL your backend serves the keybox from |

Tricky Addon fetches this URL and sets the response body as the active keybox.

### 3. Error (Optional but Recommended)

If you can't serve the download:

```
Your Iframe → Parent
{ "type": "error", "error": "<code>", "identity": "<identity>" }
```

| Field      | Type     | Description                            |
|------------|----------|----------------------------------------|
| `type`     | `string` | Always `"error"`                       |
| `error`    | `string` | Error code (convention: `"download_failed"`) |
| `identity` | `string` | The keybox identity that failed         |

Tricky Addon will show an error snackbar to the user and close the repo overlay.

---

## Iframe Detection

Use the standard check `window.top !== window.self` to detect iframe mode. When embedded:

- **Suppress standalone UI** — Hide the theme toggle, hide action buttons (Share/Download) on selected cards
- **Immediate download on click** — Selecting a card should immediately trigger download, no extra button press needed
- **Hide upload** — The parent app handles setting keyboxes; don't expose upload in iframe mode

---

## Reference Implementation

This is exactly how the reference repo site does it — borrow what you like, ignore what you don't:

```typescript
class IframeHandler {
  private static parentOrigin: string | null = null;

  static isIframe(): boolean {
    return window.top !== window.self;
  }

  static sendDownload(url: string) {
    if (IframeHandler.parentOrigin) {
      window.parent.postMessage({ type: 'download', url }, IframeHandler.parentOrigin);
    }
  }

  static sendError(identity: string) {
    if (IframeHandler.parentOrigin) {
      window.parent.postMessage(
        { type: 'error', error: 'download_failed', identity },
        IframeHandler.parentOrigin,
      );
    }
  }
}

// React hook — mount once in iframe mode
useEffect(() => {
  if (!IframeHandler.isIframe()) return;

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'handshake') {
      IframeHandler.parentOrigin = event.origin;
      window.parent.postMessage({ type: 'handshake_ack' }, event.origin);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

---

## Reference: How Tricky Addon Integrates

To help you reason about the parent side, here is what Tricky Addon does:

1. Creates an iframe pointing to your repo URL with permissions `clipboard-read; clipboard-write`
2. Sends `{ type: "handshake" }` every 500ms until it receives `handshake_ack`
3. Validates `event.origin` matches the configured repo URL
4. On `download`: fetches the URL via `fetch()`, sets the response as the active keybox, closes the overlay
5. On `error`: closes the overlay, shows an error snackbar
6. Pushes history state so the back button closes the repo overlay

---

## Optional: Backend API Structure

Your backend needs to serve two things: keybox listings for the UI, and keybox files for download. Here is how the reference backend does it:

| Method | Path                               | Purpose                                   |
|--------|------------------------------------|-------------------------------------------|
| `GET`  | `/api/keyboxes`                    | List/search keyboxes                      |
| `GET`  | `/api/keyboxes/:identity`          | Get a single keybox's metadata            |
| `POST` | `/api/keyboxes/:identity/download` | Generate a download URL                   |
| `POST` | `/api/keyboxes`                    | Upload a new keybox (standalone mode only) |
| `GET`  | `/download/:token`                 | Serve the keybox file                     |

The download flow in the reference uses **one-time tokens** — `POST /api/keyboxes/:identity/download` returns a single-use URL that expires after 24h. This is a good security practice but entirely optional. You could serve files directly, use signed URLs, or any other mechanism.

```json
// POST /api/keyboxes/:identity/download → 200
{ "token": "uuid", "url": "/download/uuid", "expires_at": "2026-06-06T..." }

// GET /download/:token → 200
// Content-Type: application/xml
// Content-Disposition: attachment; filename="keybox.xml"

// GET /download/:token → 404 (expired or already consumed)
{ "error": "token not found" }
```
