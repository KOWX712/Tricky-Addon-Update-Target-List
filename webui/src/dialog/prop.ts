import type { MdDialog, MdFilledButton, MdOutlinedButton, MdOutlinedTextField, MdSwitch } from '@material/web/all'
import { i18n } from '../i18n'
import { File } from '../file'
import type { Cli } from '../cli'
import { Config } from '../config'
import type { Snackbar } from '../snackbar/snackbar'
import { applyDialogAnimation } from './animation'

const BOOT_HASH_PATH = '/data/adb/boot_hash'
const DISABLE_PROP_HANDLER_PATH = '/data/adb/disable_prop_handler'

export class PropDialog {
  #dialog: MdDialog | null = null
  #cli: Cli
  #config: Config
  #snackbar: Snackbar

  constructor(cli: Cli, config: Config, snackbar: Snackbar) {
    this.#cli = cli
    this.#config = config
    this.#snackbar = snackbar
  }

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="prop-dialog">
        <div slot="headline">${i18n.t('menu_prop_setting')}</div>
        <div slot="content">
          <label class="switch-item contrast" for="prop-setting-switch">
            <md-ripple></md-ripple>
            <span>${i18n.t('prop_handler')}</span>
            <md-switch icons="true" id="prop-setting-switch"></md-switch>
          </label>
          <md-divider></md-divider>
          <md-outlined-text-field id="boot-hash-input" label="${i18n.t('boot_hash_title')}" type="textarea" rows="4" placeholder="241890bd44131d34c077cb01a0c3ea1ff68533b21e9d83b3f3adca6663c3d443"></md-outlined-text-field>
        </div>
        <div slot="actions">
          <md-outlined-button id="close-prop">${i18n.t('functional_button_close')}</md-outlined-button>
          <md-filled-button id="save-prop">${i18n.t('functional_button_save')}</md-filled-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#prop-dialog')

    const switchItem = fragment.querySelector<MdSwitch>('#prop-setting-switch')
    switchItem?.addEventListener('change', async () => {
      try {
        if (switchItem.selected) {
          await File.delete(DISABLE_PROP_HANDLER_PATH)
        } else {
          await File.createFile(DISABLE_PROP_HANDLER_PATH)
        }
      } catch (error) {
        switchItem.selected = !switchItem.selected
        console.error(error)
      }
    })

    const bootHashInput = fragment.querySelector<MdOutlinedTextField>('#boot-hash-input')
    bootHashInput?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement
      input.value = input.value.toLowerCase()
    })

    fragment.querySelector<MdOutlinedButton>('#close-prop')!.onclick = () => this.close()
    fragment.querySelector<MdFilledButton>('#save-prop')!.onclick = () => this.#save()

    return fragment
  }

  initAnimation(): void {
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  async show(): Promise<void> {
    const bootHashInput = this.#dialog?.querySelector<MdOutlinedTextField>('#boot-hash-input')
    if (bootHashInput) {
      try {
        const content = await File.read(BOOT_HASH_PATH)
        bootHashInput.value = content.trim()
      } catch {
        bootHashInput.value = ''
      }
    }

    const disableSwitch = this.#dialog?.querySelector<MdSwitch>('#prop-setting-switch')
    if (disableSwitch) {
      try {
        disableSwitch.selected = !await File.exist(DISABLE_PROP_HANDLER_PATH)
      } catch {
        disableSwitch.selected = false
      }
    }

    this.#dialog?.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  async #save(): Promise<void> {
    this.close()
    try {
      const bootHashInput = document.querySelector<MdOutlinedTextField>('#boot-hash-input')
      const hash = bootHashInput?.value?.trim() ?? ''

      if (hash) {
        await File.write(BOOT_HASH_PATH, hash)
        await this.#cli.setBootHash(hash)

        if (this.#config.policySchema.getField('vb_hash')) {
          const data = this.#config.get()
          const policy = data.default_policy ?? {}
          policy.vb_hash = hash
          data.default_policy = policy
          await this.#config.write()
        }
      } else {
        await File.delete(BOOT_HASH_PATH)
      }

      this.#snackbar.show(i18n.t('prompt_boot_hash_set'))
    } catch {
      this.#snackbar.show(i18n.t('prompt_boot_hash_set_error'), false)
    }
  }
}
