import type { MdDialog } from '@material/web/all'
import { i18n } from '../i18n'
import { Cli } from '../cli'
import { File } from '../file'
import { FileSelector } from '../file_selector/file_selector'
import { Snackbar } from '../snackbar/snackbar'
import { generateUnknownKeybox, isKeygenAvailable } from './unknown'
import { CustomKeyboxProvider } from './custom'
import { Config } from '../config'
import { ConfigOhMyKeyMint } from '../config_ohmykeymint'
import { OMK_KEYBOX_FILE } from '../constant'
import { applyDialogAnimation } from '../dialog/animation'
import './keybox.scss'

export class Keybox {
  readonly cli: Cli
  readonly custom: CustomKeyboxProvider
  readonly #config: Config
  #fileSelector: FileSelector
  #snackbar: Snackbar

  constructor(cli: Cli, config: Config, fileSelector: FileSelector, snackbar: Snackbar) {
    this.cli = cli
    this.#config = config
    this.#fileSelector = fileSelector
    this.#snackbar = snackbar
    this.custom = new CustomKeyboxProvider(this, fileSelector, snackbar)
  }

  /**
   * Return the correct keybox.xml path depending on the active engine.
   * OMK keeps its keybox at /data/misc/keystore/omk/keybox.xml
   * TrickyStore uses  /data/adb/tricky_store/keybox.xml
   */
  get keyboxPath(): string {
    if (this.#config instanceof ConfigOhMyKeyMint) {
      return OMK_KEYBOX_FILE
    }
    return this.#config.configPath + '/keybox.xml'
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
    const kbxPath = this.keyboxPath
    const isOmk = this.#config instanceof ConfigOhMyKeyMint

    // Backup existing keybox before writing
    if (isOmk) {
      await this.cli.exec(`su -c "cp -f '${kbxPath}' '${kbxPath}.bak'"`).catch(() => {})
    } else {
      await File.move(kbxPath, `${kbxPath}.bak`).catch(() => {})
    }

    let written = false

    try {
      if (isOmk) {
        // For OMK: write to temp file first, then copy with proper ownership.
        // The /data/misc/keystore/omk/ directory requires keystore user (1017) ownership.
        // Use base64 to safely pass XML content through shell.
        const ts = Date.now()
        const tmpB64 = `/data/local/tmp/keybox_${ts}.b64`
        const tmpDecoded = `/data/local/tmp/keybox_${ts}.xml`
        const b64Content = btoa(unescape(encodeURIComponent(content.trim())))
        // Write base64 to temp file
        await this.cli.exec(`sh -c 'echo "${b64Content}" > "${tmpB64}"'`)
        // Decode and place with correct ownership
        await this.cli.exec(`su -c "base64 -d '${tmpB64}' > '${tmpDecoded}' && cp -f '${tmpDecoded}' '${kbxPath}' && chown 1017:1017 '${kbxPath}' && chmod 0600 '${kbxPath}' && rm -f '${tmpB64}' '${tmpDecoded}'"`)
        // Verify the file was actually written
        const newContent = await File.read(kbxPath).catch(() => '')
        written = newContent.includes('<AndroidAttestation>')
      } else {
        await File.write(kbxPath, content, cmd)
        const newContent = await File.read(kbxPath).catch(() => '')
        written = newContent.length > 0
      }

      // If write failed, restore backup
      if (!written) {
        await this.cli.exec(`su -c "cp -f '${kbxPath}.bak' '${kbxPath}' 2>/dev/null"`).catch(() => {})
        if (!isOmk) {
          await File.move(`${kbxPath}.bak`, kbxPath).catch(() => {})
        }
      }

      return written
    } catch {
      // Restore backup on error
      try {
        if (isOmk) {
          await this.cli.exec(`su -c "cp -f '${kbxPath}.bak' '${kbxPath}' 2>/dev/null"`)
        } else {
          await File.move(`${kbxPath}.bak`, kbxPath).catch(() => {})
        }
      } catch {}
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
