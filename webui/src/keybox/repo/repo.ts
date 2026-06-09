import './repo.scss'
import { i18n } from '../../i18n'
import type { History } from '../../history'
import type { Snackbar } from '../../snackbar/snackbar'
import type { Keybox } from '../keybox'
import { KEYBOX_REPO_URL } from '../../constant'

interface DownloadMessage {
  type: 'download'
  url: string
}

interface ErrorMessage {
  type: 'error'
  error: string
  identity: string
}

type IframeMessage = DownloadMessage | ErrorMessage | { type: 'handshake_ack' }

export class KeyboxRepo {
  static readonly HISTORY_KEY = 'keybox-repo'

  readonly #keybox: Keybox
  readonly #history: History
  readonly #snackbar: Snackbar
  #overlay: HTMLElement | null = null
  #iframe: HTMLIFrameElement | null = null
  #loadingEl: HTMLElement | null = null
  #isLoaded = false
  #boundOnMessage: (event: MessageEvent) => void
  #handshakeInterval?: number

  constructor(keybox: Keybox, history: History, snackbar: Snackbar) {
    this.#keybox = keybox
    this.#history = history
    this.#snackbar = snackbar
    this.#boundOnMessage = this.#onMessage.bind(this)
  }

  appendTo(container: HTMLElement): void {
    container.appendChild(this.#getElement())
  }

  #createIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe')
    iframe.className = 'keybox-repo-iframe'
    iframe.setAttribute('width', '100%')
    iframe.setAttribute('height', '100%')
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write')
    iframe.addEventListener('load', () => {
      this.#startHandshake()
      this.#hideLoading()
    })
    return iframe
  }

  #startHandshake(): void {
    this.#stopHandshake()
    this.#iframe?.contentWindow?.postMessage({ type: 'handshake' }, KEYBOX_REPO_URL)
    this.#handshakeInterval = window.setInterval(() => {
      this.#iframe?.contentWindow?.postMessage({ type: 'handshake' }, KEYBOX_REPO_URL)
    }, 500)
  }

  #stopHandshake(): void {
    if (this.#handshakeInterval !== undefined) {
      window.clearInterval(this.#handshakeInterval)
      this.#handshakeInterval = undefined
    }
  }

  #showLoading(): void {
    if (this.#loadingEl) {
      this.#loadingEl.style.display = ''
    }
  }

  #hideLoading(): void {
    if (this.#loadingEl) {
      this.#loadingEl.style.display = 'none'
    }
  }

  #getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <div id="keybox-repo-overlay" class="keybox-repo-overlay hidden">
        <button id="keybox-repo-close" class="keybox-repo-close" aria-label="${i18n.t('functional_button_close')}">
          <md-icon>close</md-icon>
        </button>
        <div id="keybox-repo-loading" class="keybox-repo-loading">
          <md-circular-progress indeterminate></md-circular-progress>
        </div>
      </div>
    `

    const fragment = template.content
    this.#overlay = fragment.querySelector<HTMLElement>('#keybox-repo-overlay')
    this.#loadingEl = fragment.querySelector<HTMLElement>('#keybox-repo-loading')
    this.#iframe = this.#createIframe()
    this.#overlay?.appendChild(this.#iframe)

    const closeBtn = fragment.querySelector<HTMLElement>('#keybox-repo-close')
    closeBtn?.addEventListener('click', () => this.close())

    this.#overlay?.addEventListener('animationend', (e) => {
      if (e.animationName === 'keybox-repo-close') {
        this.#overlay?.classList.remove('closing')
        this.#overlay?.classList.add('hidden')
      }
    })

    window.addEventListener('message', this.#boundOnMessage)

    return fragment
  }

  show(): void {
    if (!this.#overlay || !this.#iframe) return
    this.#overlay.classList.remove('closing')
    if (!this.#overlay.classList.contains('hidden')) return

    if (this.#isLoaded) {
      this.#stopHandshake()
      const newIframe = this.#createIframe()
      this.#overlay.replaceChild(newIframe, this.#iframe)
      this.#iframe = newIframe
    } else {
      this.#isLoaded = true
    }

    this.#showLoading()
    this.#iframe.src = `${KEYBOX_REPO_URL}/${i18n.lang}`
    this.#overlay?.classList.remove('hidden')

    this.#history.push(KeyboxRepo.HISTORY_KEY, () => this.close())
  }

  close(): void {
    if (this.#overlay?.classList.contains('hidden') || this.#overlay?.classList.contains('closing')) return
    this.#overlay?.classList.add('closing')
    this.#history.consume(KeyboxRepo.HISTORY_KEY)
    this.#stopHandshake()
  }

  #onMessage(event: MessageEvent): void {
    if (event.origin !== KEYBOX_REPO_URL) return

    const msg = event.data as IframeMessage

    switch (msg.type) {
      case 'handshake_ack':
        this.#stopHandshake()
        break

      case 'download':
        this.close()
        this.#fetchAndSetKeybox(msg.url).catch(() => {})
        break

      case 'error':
        this.close()
        this.#snackbar.show(
          i18n.t('prompt_keybox_repo_download_error', msg.identity),
          false,
        )
        break
    }
  }

  async #fetchAndSetKeybox(url: string): Promise<void> {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        this.#snackbar.show(i18n.t('prompt_keybox_repo_set_error'), false)
        return
      }
      const content = await response.text()
      if (!content.trim()) {
        this.#snackbar.show(i18n.t('prompt_keybox_repo_set_error'), false)
        return
      }
      const ok = await this.#keybox.setKeybox(content)
      this.#snackbar.show(i18n.t(ok ? 'prompt_keybox_repo_set' : 'prompt_keybox_repo_set_error'), ok)
    } catch {
      this.#snackbar.show(i18n.t('prompt_keybox_repo_set_error'), false)
    }
  }
}
