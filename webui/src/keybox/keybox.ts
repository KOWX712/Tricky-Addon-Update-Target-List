import type { MdDialog } from '@material/web/all'
import { i18n } from '../i18n'
import { Cli } from '../cli'
import { File } from '../file'
import { FileSelector } from '../file_selector/file_selector'
import { Snackbar } from '../snackbar/snackbar'
import { generateUnknownKeybox, isKeygenAvailable } from './unknown'
import { CustomKeyboxProvider } from './custom'
import { TS_PATH } from '../constant'
import { applyDialogAnimation } from '../dialog/animation'
import './keybox.scss'

export const KEYBOX_PATH = TS_PATH + '/keybox.xml'

export class Keybox {
  readonly cli: Cli
  readonly custom: CustomKeyboxProvider
  #fileSelector: FileSelector
  #snackbar: Snackbar

  constructor(cli: Cli, fileSelector: FileSelector, snackbar: Snackbar) {
    this.cli = cli
    this.#fileSelector = fileSelector
    this.#snackbar = snackbar
    this.custom = new CustomKeyboxProvider(this, fileSelector, snackbar)
  }

  appendTo(container: HTMLElement): void {
    container.appendChild(this.#getElement())
    container.querySelectorAll<MdDialog>('md-dialog').forEach(d => applyDialogAnimation(d))
  }

  #getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="customkb-dialog" class="text-field-dialog">
        <div slot="headline">${i18n.t('customkb_dialog_title')}</div>
        <div slot="content">
          <md-outlined-text-field id="customkb-name-input" label="Name" placeholder="${i18n.t('customkb_name_placeholder')}" class="customkb-input">
            <md-icon slot="trailing-icon" class="hidden">error</md-icon>
          </md-outlined-text-field>
          <md-outlined-text-field id="customkb-link-input" label="URL" type="url" placeholder="https://raw.githubusercontent.com/" class="customkb-input">
            <md-icon slot="trailing-icon" class="hidden">error</md-icon>
          </md-outlined-text-field>
          <md-outlined-text-field id="customkb-script-input" label="Decode Script" placeholder="${i18n.t('customkb_script_placeholder')}" class="customkb-input" error-text="${i18n.t('prompt_custom_invalid_script')}">
            <md-icon slot="trailing-icon" class="hidden">error</md-icon>
          </md-outlined-text-field>
          <md-divider class="new"></md-divider>
          <div class="customkb-actions new">
            <md-filled-tonal-icon-button id="customkb-import"><md-icon>download</md-icon></md-filled-tonal-icon-button>
            <md-filled-tonal-icon-button id="customkb-export"><md-icon>upload</md-icon></md-filled-tonal-icon-button>
          </div>
        </div>
        <div slot="actions">
          <md-text-button id="reset-customkb" class="new">${i18n.t('functional_button_reset')}</md-text-button>
          <md-text-button id="remove-customkb" class="old">${i18n.t('functional_button_remove')}</md-text-button>
          <div class="spacer"></div>
          <md-text-button id="cancel-customkb">${i18n.t('functional_button_cancel')}</md-text-button>
          <md-text-button id="save-customkb">${i18n.t('functional_button_save')}</md-text-button>
        </div>
      </md-dialog>

      <md-dialog id="customkb-remove-dialog" type="alert">
        <div slot="headline">${i18n.t('customkb_remove_title')}</div>
        <md-icon slot="icon">delete</md-icon>
        <div slot="content">
          <div id="customkb-remove-single">${i18n.t('customkb_remove_message')}</div>
          <div id="customkb-reset" style="display: none">${i18n.t('customkb_reset_message')}</div>
        </div>
        <div slot="actions">
          <md-outlined-button id="cancel-remove-customkb">${i18n.t('functional_button_cancel')}</md-outlined-button>
          <md-filled-button id="confirm-remove-customkb">${i18n.t('functional_button_confirm')}</md-filled-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.custom.bind(fragment)
    return fragment
  }

  async setKeybox(content: string, cmd: string = 'cat'): Promise<boolean> {
    await File.move(KEYBOX_PATH, `${KEYBOX_PATH}.bak`).catch(() => {})

    try {
      await File.write(KEYBOX_PATH, content, cmd)
      return true
    } catch {
      return false
    }
  }

  async setAospKey(): Promise<void> {
    try {
      const content = await this.cli.getAospKey()
      const result = await this.setKeybox(content)
      this.#snackbar.show(i18n.t(result ? 'prompt_aosp_key_set' : 'prompt_key_set_error'), result)
    } catch {
      this.#snackbar.show(i18n.t('prompt_key_set_error'), false)
    }
  }

  async setUnknownKey(): Promise<void> {
    try {
      const keyboxContent = await generateUnknownKeybox()
      const result = await this.setKeybox(keyboxContent)
      this.#snackbar.show(i18n.t(result ? 'prompt_unknown_key_set' : 'prompt_key_set_error'), result)
    } catch (error) {
      console.error(error)
      this.#snackbar.show(i18n.t('prompt_key_set_error'), false)
    }
  }

  async setLocalKey(): Promise<void> {
    try {
      const content = await this.#fileSelector.getFileContent('xml')
      if (!content) return
      const result = await this.setKeybox(content)
      this.#snackbar.show(i18n.t(result ? 'prompt_custom_key_set' : 'prompt_key_set_error'), result)
    } catch {
      this.#snackbar.show(i18n.t('prompt_key_set_error'), false)
    }
  }

  static isKeygenAvailable(): boolean {
    return isKeygenAvailable()
  }
}
