import type { MdDialog, MdTextButton } from '@material/web/all'
import { i18n } from '../i18n'
import { applyDialogAnimation } from './animation'

export class HelpDialog {
  #dialog: MdDialog | null = null

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="help-dialog">
        <div slot="headline">${i18n.t('help_help_instructions')}</div>
        <div slot="content" class="help-content">
          <div class="instruction">
            <strong>${i18n.t('functional_button_save')}</strong>
            <p>${i18n.t('help_save_and_update_description')}</p>
          </div>
          <div class="instruction">
            <strong>${i18n.t('help_select_denylist')}</strong>
            <p>${i18n.t('help_select_denylist_description')}</p>
          </div>
          <div class="instruction">
            <strong>${i18n.t('help_deselect_unnecessary')}</strong>
            <p>${i18n.t('help_deselect_unnecessary_description')}</p>
          </div>
          <div class="instruction">
            <strong>${i18n.t('help_add_system_app')}</strong>
            <p>${i18n.t('help_add_system_app_description')}</p>
          </div>
          <div class="instruction">
            <strong>${i18n.t('help_set_keybox')}</strong>
            <p>${i18n.t('help_set_keybox_description')}</p>
            <ul>
              <li>${i18n.t('help_set_keybox_aosp')}</li>
              <li>${i18n.t('help_set_keybox_unknown')}</li>
              <li>${i18n.t('help_set_keybox_local')}</li>
              <li>${i18n.t('help_set_keybox_custom')}</li>
            </ul>
          </div>
          <div class="instruction">
            <strong>${i18n.t('help_set_security_patch')}</strong>
            <p>${i18n.t('help_set_security_patch_description')}</p>
          </div>
          <div class="instruction">
            <strong>${i18n.t('help_set_verified_boot_hash')}</strong>
            <p>${i18n.t('help_set_verified_boot_hash_description')}</p>
          </div>
        </div>
        <div slot="actions">
          <md-text-button id="close-help">${i18n.t('functional_button_close')}</md-text-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#help-dialog')

    fragment.querySelector<MdTextButton>('#close-help')!.onclick = () => this.close()

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
}
