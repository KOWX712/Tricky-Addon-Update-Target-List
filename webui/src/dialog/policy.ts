import type { MdDialog, MdFilledButton, MdOutlinedButton } from '@material/web/all'
import { i18n } from '../i18n'
import { Config } from '../config'
import { ConfigOhMyKeyMint } from '../config_ohmykeymint'
import { PolicyEditor } from '../app_list/policy'
import { applyDialogAnimation } from './animation'

export class DefaultPolicyDialog {
  #dialog: MdDialog | null = null
  #policyEditor: PolicyEditor | null = null
  #config: Config

  constructor(config: Config) {
    this.#config = config
  }

  getElement(): DocumentFragment {
    const isOmk = this.#config instanceof ConfigOhMyKeyMint
    const schema = isOmk
      ? (this.#config as ConfigOhMyKeyMint).extendedPolicySchema
      : this.#config.policySchema

    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="default-policy-dialog">
        <div slot="headline">${i18n.t('default_policy_title')}</div>
        <div slot="content">
          <div id="default-policy-fields" class="policy-fields">
            ${PolicyEditor.html(schema)}
          </div>
        </div>
        <div slot="actions">
          <md-outlined-button id="close-default-policy">${i18n.t('functional_button_cancel')}</md-outlined-button>
          <md-filled-button id="save-default-policy">${i18n.t('functional_button_save')}</md-filled-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#default-policy-dialog')

    const fields = fragment.querySelector<HTMLElement>('#default-policy-fields')!
    this.#policyEditor = new PolicyEditor(fields, schema)
    this.#policyEditor.bind()

    fragment.querySelector<MdOutlinedButton>('#close-default-policy')!.onclick = () => this.close()
    fragment.querySelector<MdFilledButton>('#save-default-policy')!.onclick = () => this.#save()

    return fragment
  }

  initAnimation(): void {
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  show(): void {
    const configData = this.#config.get()
    const policy = configData.default_policy ?? {}
    this.#policyEditor?.setPolicy(policy)
    this.#dialog?.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  #save(): void {
    if (!this.#policyEditor?.isValid()) return

    const rawPolicy = this.#policyEditor?.getPolicy() ?? {}
    const configData = this.#config.get()

    // Sanitize: convert any boolean/undefined values to strings
    const sanitized: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawPolicy)) {
      if (v !== undefined && v !== true) sanitized[k] = String(v)
    }

    if (Object.keys(sanitized).length > 0) {
      configData.default_policy = sanitized
    } else {
      delete configData.default_policy
    }

    this.#config.write()
    this.close()
  }
}
