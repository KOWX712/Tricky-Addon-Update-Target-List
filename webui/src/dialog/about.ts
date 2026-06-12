import type { MdDialog, MdFilledButton, MdOutlinedSelect, MdTextButton } from '@material/web/all'
import { i18n } from '../i18n'
import { Cli } from '../cli'
import type { UpdateManager } from '../update'
import type { Snackbar } from '../snackbar/snackbar'
import type { Config } from '../config'
import { LOCAL_STORAGE_PREFIX, TELEGRAM_CHANNEL, GITHUB_REPO } from '../constant'
import { applyDialogAnimation } from './animation'

const UPDATE_CHANNEL_KEY = `${LOCAL_STORAGE_PREFIX}UpdateChannel`

export class AboutDialog {
  #dialog: MdDialog | null = null
  #cli: Cli
  #updateManager: UpdateManager
  #snackbar: Snackbar
  #config: Config

  constructor(cli: Cli, updateManager: UpdateManager, snackbar: Snackbar, config: Config) {
    this.#cli = cli
    this.#updateManager = updateManager
    this.#snackbar = snackbar
    this.#config = config
  }

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="about-dialog">
        <div slot="headline" class="about-headline">
          <div class="about-title-row">
            <div id="module_name_line1">${i18n.t('about_module_name_line1')}</div>
            <div id="working-mode-tag">${this.#config.identity}</div>
          </div>
          <div id="module_name_line2">${i18n.t('about_module_name_line2')}</div>
          <div id="module-version"></div>
          <div id="author"><span id="authored">${i18n.t('about_by')}</span> KOWX712</div>
        </div>
        <div slot="content">
          <div id="disclaimer">${i18n.t('about_disclaimer')}</div>
          <md-outlined-select id="channel-selector" label="${i18n.t('update_channel')}" menu-positioning="popover" clamp-menu-width>
            <md-select-option value="stable">
              <div slot="headline">${i18n.t('update_channel_stable')}</div>
            </md-select-option>
            <md-select-option value="canary">
              <div slot="headline">${i18n.t('update_channel_canary')}</div>
            </md-select-option>
            <md-select-option value="disable">
              <div slot="headline">${i18n.t('update_channel_disable')}</div>
            </md-select-option>
          </md-outlined-select>
          <div class="link">
            <md-filled-button id="telegram">
              <span>${i18n.t('about_telegram_channel')}</span>
              <svg slot="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.114 9.291c.552-.552 1.1-1.84-1.2-.276a395.806 395.806 0 0 1-6.489 4.372 2.7 2.7 0 0 1-2.117.046c-1.38-.414-2.991-.966-2.991-.966s-1.1-.691.783-1.427c0 0 7.961-3.267 10.722-4.418 1.058-.46 4.647-1.932 4.647-1.932s1.657-.645 1.519.92c-.046.644-.414 2.9-.782 5.338-.553 3.451-1.151 7.225-1.151 7.225s-.092 1.058-.874 1.242a3.787 3.787 0 0 1-2.3-.828c-.184-.138-3.451-2.209-4.648-3.221a.872.872 0 0 1 .046-1.473 169.31 169.31 0 0 0 4.835-4.602Z"></path></svg>
            </md-filled-button>
            <md-filled-button id="github">
              <span>GitHub</span>
              <svg slot="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 1A10.89 10.89 0 0 0 1 11.77 10.79 10.79 0 0 0 8.52 22c.55.1.75-.23.75-.52v-1.83c-3.06.65-3.71-1.44-3.71-1.44a2.86 2.86 0 0 0-1.22-1.58c-1-.66.08-.65.08-.65a2.31 2.31 0 0 1 1.68 1.11 2.37 2.37 0 0 0 3.2.89 2.33 2.33 0 0 1 .7-1.44c-2.44-.27-5-1.19-5-5.32a4.15 4.15 0 0 1 1.11-2.91 3.78 3.78 0 0 1 .11-2.84s.93-.29 3 1.1a10.68 10.68 0 0 1 5.5 0c2.1-1.39 3-1.1 3-1.1a3.78 3.78 0 0 1 .11 2.84A4.15 4.15 0 0 1 19 11.2c0 4.14-2.58 5.05-5 5.32a2.5 2.5 0 0 1 .75 2v2.95c0 .35.2.63.75.52A10.8 10.8 0 0 0 23 11.77 10.89 10.89 0 0 0 12 1"></path></svg>
            </md-filled-button>
            <md-filled-button id="canary">
              <span>${i18n.t('about_canary_update')}</span>
              <md-icon slot="icon">science</md-icon>
            </md-filled-button>
            <md-filled-button id="locales">
              <span>${i18n.t('about_translation_update')}</span>
              <md-icon slot="icon">translate</md-icon>
            </md-filled-button>
          </div>
          <div class="acknowledgment">
            <p id="acknowledgment">${i18n.t('about_acknowledgment')}</p>
            <p>markedjs/marked: Markdown Support</p>
          </div>
        </div>
        <div slot="actions">
          <md-text-button id="close-about">${i18n.t('functional_button_close')}</md-text-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#about-dialog')

    this.#loadModuleVersion()

    fragment.querySelector<MdFilledButton>('#telegram')!.onclick = () => this.#cli.linkRedirect(TELEGRAM_CHANNEL)
    fragment.querySelector<MdFilledButton>('#github')!.onclick = () => this.#cli.linkRedirect(`https://github.com/${GITHUB_REPO}`)
    fragment.querySelector<MdFilledButton>('#canary')!.onclick = async () => {
      this.close()
      try {
        this.#snackbar.show(i18n.t('prompt_checking_update'))
        const info = await this.#updateManager.checkUpdate('canary')
        if (info.available) {
          this.#snackbar.show(i18n.t('prompt_downloading'))
          const ok = await this.#updateManager.update('canary')
          if (ok) {
            this.#snackbar.show(i18n.t('prompt_installed'))
          } else {
            this.#snackbar.show(i18n.t('prompt_install_fail'), false)
          }
        } else {
          this.#snackbar.show(i18n.t('prompt_no_update'))
        }
      } catch {
        this.#snackbar.show(i18n.t('prompt_download_fail'), false)
      }
    }
    fragment.querySelector<MdFilledButton>('#locales')!.onclick = async () => {
      this.close()
      try {
        const ok = await this.#updateManager.updateLocales()
        this.#snackbar.show(i18n.t(ok ? 'prompt_translation_updated' : 'prompt_no_update'))
        if (ok) setTimeout(() => window.location.reload(), 0)
      } catch {
        this.#snackbar.show(i18n.t('prompt_translation_update_failed'), false)
      }
    }
    fragment.querySelector<MdTextButton>('#close-about')!.onclick = () => this.close()

    const channelSelect = fragment.querySelector<MdOutlinedSelect>('#channel-selector')
    if (channelSelect) {
      const savedChannel = localStorage.getItem(UPDATE_CHANNEL_KEY) || 'stable'
      channelSelect.value = savedChannel
      channelSelect.addEventListener('change', () => {
        localStorage.setItem(UPDATE_CHANNEL_KEY, channelSelect.value)
        document.dispatchEvent(new CustomEvent('update-channel-changed'))
      })
    }

    return fragment
  }

  initAnimation(): void {
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  show(): void {
    this.#dialog?.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  async #loadModuleVersion(): Promise<void> {
    try {
      const basePath = await this.#cli.getBasePath()
      let version = await this.#cli.grepProp('version', `${basePath}/common/update/module.prop`)
      if (import.meta.env.DEV) version = 'v5.0 (690581)'
      if (version) {
        const el = this.#dialog?.querySelector('#module-version')
        if (el) el.textContent = version
      }
    } catch (e) {
      console.error('Failed to load module version:', e)
    }
  }
}
