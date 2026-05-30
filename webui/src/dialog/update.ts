import type { MdDialog, MdFilledButton, MdOutlinedButton } from '@material/web/all'
import { i18n } from '../i18n'
import type { Cli } from '../cli'
import type { UpdateManager } from '../update'
import type { Snackbar } from '../snackbar/snackbar'
import { LOCAL_STORAGE_PREFIX } from '../constant'
import { applyDialogAnimation } from './animation'
import { renderMarkdown } from './markdown'

export class UpdateDialog {
  #dialog: MdDialog | null = null
  #changelogEl: HTMLElement | null = null
  #cli: Cli
  #updateManager: UpdateManager
  #snackbar: Snackbar
  #rebootMode = false

  constructor(cli: Cli, updateManager: UpdateManager, snackbar: Snackbar) {
    this.#cli = cli
    this.#updateManager = updateManager
    this.#snackbar = snackbar
  }

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="update-dialog">
        <div slot="headline">${i18n.t('update_changelog')}</div>
        <div slot="content" class="markdown-content"></div>
        <div slot="actions" class="update-actions">
          <md-outlined-button id="cancel-update">${i18n.t('functional_button_cancel')}</md-outlined-button>
          <md-filled-button id="install-update">${i18n.t('update_install')}</md-filled-button>
          <md-filled-button id="reboot-after-update" class="hide">${i18n.t('update_reboot')}</md-filled-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#update-dialog')
    this.#changelogEl = fragment.querySelector<HTMLElement>('.markdown-content')

    fragment.querySelector<MdOutlinedButton>('#cancel-update')!.onclick = () => this.close()
    fragment.querySelector<MdFilledButton>('#install-update')!.onclick = () => this.#performUpdate()
    fragment.querySelector<MdFilledButton>('#reboot-after-update')!.onclick = () => this.#performReboot()

    return fragment
  }

  initAnimation(): void {
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  show(changelog: string): void {
    if (!this.#changelogEl || !this.#dialog) return
    renderMarkdown(changelog, this.#changelogEl, this.#cli)
    this.#rebootMode = false
    this.#updateButtonState()
    this.#dialog.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  #updateButtonState(): void {
    const installBtn = this.#dialog?.querySelector<HTMLElement>('#install-update')
    const rebootBtn = this.#dialog?.querySelector<HTMLElement>('#reboot-after-update')
    if (!installBtn || !rebootBtn) return

    if (this.#rebootMode) {
      installBtn.classList.add('hide')
      rebootBtn.classList.remove('hide')
    } else {
      installBtn.classList.remove('hide')
      rebootBtn.classList.add('hide')
    }
  }

  async #performUpdate(): Promise<void> {
    const channel = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}UpdateChannel`) || 'stable'
    if (channel === 'disable') return
    try {
      this.#snackbar.show(i18n.t('prompt_downloading'))
      const ok = await this.#updateManager.update(channel as 'stable' | 'canary')
      if (ok) {
        this.#snackbar.show(i18n.t('prompt_installed'))
        this.#rebootMode = true
        this.#updateButtonState()
      } else {
        this.#snackbar.show(i18n.t('prompt_install_fail'), false)
      }
    } catch {
      this.#snackbar.show(i18n.t('prompt_download_fail'), false)
    }
  }

  async #performReboot(): Promise<void> {
    try {
      this.#snackbar.show(i18n.t('prompt_rebooting'))
      await this.#cli.reboot()
    } catch {
      this.#snackbar.show(i18n.t('prompt_reboot_fail'), false)
    }
  }
}
