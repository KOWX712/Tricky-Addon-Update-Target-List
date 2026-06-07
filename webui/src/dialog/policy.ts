import type { MdDialog, MdFilledButton, MdOutlinedButton } from '@material/web/all'
import { i18n } from '../i18n'
import { Config } from '../config'
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
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="default-policy-dialog">
        <div slot="headline">${i18n.t('default_policy_title')}</div>
        <div slot="content">
          <div id="default-policy-fields" class="policy-fields">
            ${PolicyEditor.html(this.#config.policySchema)}
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

    const fieldsContainer = fragment.querySelector<HTMLElement>('#default-policy-fields')!
    this.#policyEditor = new PolicyEditor(fieldsContainer, this.#config.policySchema)
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
    this.#policyEditor?.setPolicy(configData.default_policy ?? null)
    this.#dialog?.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  #save(): void {
    if (!this.#policyEditor?.isValid()) return
    const policy = this.#policyEditor?.getPolicy()
    const configData = this.#config.get()
    if (policy) {
      configData.default_policy = policy
    } else {
      delete configData.default_policy
    }
    this.#config.write()
    this.close()
  }
}
