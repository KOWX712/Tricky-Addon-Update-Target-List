import type { MdDialog, MdFilledButton, MdOutlinedButton } from '@material/web/all'
import { i18n } from '../i18n'
import { Cli } from '../cli'
import type { Snackbar } from '../snackbar/snackbar'
import { MOD_ID } from '../constant'
import { applyDialogAnimation } from './animation'

export class UninstallDialog {
  #dialog: MdDialog | null = null
  #cli: Cli
  #snackbar: Snackbar

  constructor(cli: Cli, snackbar: Snackbar) {
    this.#cli = cli
    this.#snackbar = snackbar
  }

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="uninstall-confirmation-dialog" type="alert">
        <div slot="headline">${i18n.t('confirmation_uninstall_title')}</div>
        <md-icon slot="icon">delete</md-icon>
        <div slot="content">${i18n.t('confirmation_uninstall_message')}</div>
        <div slot="actions">
          <md-outlined-button id="cancel-uninstall">${i18n.t('functional_button_cancel')}</md-outlined-button>
          <md-filled-button id="confirm-uninstall">${i18n.t('functional_button_confirm')}</md-filled-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#uninstall-confirmation-dialog')

    fragment.querySelector<MdOutlinedButton>('#cancel-uninstall')!.onclick = () => this.close()
    fragment.querySelector<MdFilledButton>('#confirm-uninstall')!.onclick = () => this.#confirmUninstall()

    return fragment
  }

  async #confirmUninstall(): Promise<void> {
    this.close()
    try {
      await this.#cli.uninstallModule(MOD_ID)
      this.#snackbar.show(i18n.t('prompt_uninstall_prompt'), true)
    } catch (error) {
      this.#snackbar.show(i18n.t('prompt_uninstall_failed'), false)
      console.error(error)
    }
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
}
