import type { MdDialog, MdFilledButton, MdOutlinedButton } from '@material/web/all'
import { i18n } from '../i18n'
import { Config } from '../config'
import { ConfigOhMyKeyMint } from '../config_ohmykeymint'
import { PolicyEditor } from '../app_list/policy'
import { applyDialogAnimation } from './animation'

export class DefaultPolicyDialog {
  #dialog: MdDialog | null = null
  #policyEditor: PolicyEditor | null = null
  #extendedEditor: PolicyEditor | null = null
  #config: Config
  #activeTab: 'basic' | 'advanced' = 'basic'

  constructor(config: Config) {
    this.#config = config
  }

  getElement(): DocumentFragment {
    const isOmk = this.#config instanceof ConfigOhMyKeyMint

    const template = document.createElement('template')

    if (isOmk) {
      // OMK gets a tabbed dialog with Basic / Advanced
      template.innerHTML = /* html */ `
        <md-dialog id="default-policy-dialog" class="policy-dialog-omk">
          <div slot="headline">${i18n.t('default_policy_title')}</div>
          <div slot="content">
            <div class="policy-tabs">
              <md-filled-tonal-icon-button id="tab-basic" class="policy-tab active">
                <md-icon>security</md-icon>
              </md-filled-tonal-icon-button>
              <md-filled-tonal-icon-button id="tab-advanced" class="policy-tab">
                <md-icon>tune</md-icon>
              </md-filled-tonal-icon-button>
            </div>

            <!-- Basic tab: [trust] fields -->
            <div id="policy-tab-basic" class="policy-tab-content">
              <div id="default-policy-fields" class="policy-fields">
                ${PolicyEditor.html(this.#config.policySchema)}
              </div>
            </div>

            <!-- Advanced tab: [device], [crypto], [main] fields -->
            <div id="policy-tab-advanced" class="policy-tab-content" style="display:none">
              <div class="policy-section-title">Device Spoofing</div>
              <div id="extended-policy-device-fields" class="policy-fields">
                ${PolicyEditor.html(this.#getSubSchema(['brand', 'device', 'manufacturer', 'model', 'product', 'serial']))}
              </div>
              <md-divider></md-divider>
              <div class="policy-section-title">Crypto Seeds</div>
              <div id="extended-policy-crypto-fields" class="policy-fields">
                ${PolicyEditor.html(this.#getSubSchema(['root_kek_seed', 'kak_seed', 'shared_secret_seed', 'shared_secret_nonce']))}
              </div>
              <md-divider></md-divider>
              <div class="policy-section-title">Injector</div>
              <div id="extended-policy-main-fields" class="policy-fields">
                ${PolicyEditor.html(this.#getSubSchema(['log_level']))}
              </div>
            </div>
          </div>
          <div slot="actions">
            <md-outlined-button id="close-default-policy">${i18n.t('functional_button_cancel')}</md-outlined-button>
            <md-filled-button id="save-default-policy">${i18n.t('functional_button_save')}</md-filled-button>
          </div>
        </md-dialog>
      `
    } else {
      // TrickyStore: simple single-page dialog
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
    }

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#default-policy-dialog')

    // Basic policy editor (always present)
    const basicFields = fragment.querySelector<HTMLElement>('#default-policy-fields')!
    this.#policyEditor = new PolicyEditor(basicFields, this.#config.policySchema)
    this.#policyEditor.bind()

    // OMK advanced editor
    if (isOmk) {
      const extSchema = (this.#config as ConfigOhMyKeyMint).extendedPolicySchema

      const deviceFields = fragment.querySelector<HTMLElement>('#extended-policy-device-fields')!
      const deviceEditor = new PolicyEditor(deviceFields, this.#getSubSchema(['brand', 'device', 'manufacturer', 'model', 'product', 'serial']))
      deviceEditor.bind()

      const cryptoFields = fragment.querySelector<HTMLElement>('#extended-policy-crypto-fields')!
      const cryptoEditor = new PolicyEditor(cryptoFields, this.#getSubSchema(['root_kek_seed', 'kak_seed', 'shared_secret_seed', 'shared_secret_nonce']))
      cryptoEditor.bind()

      const mainFields = fragment.querySelector<HTMLElement>('#extended-policy-main-fields')!
      const mainEditor = new PolicyEditor(mainFields, this.#getSubSchema(['log_level']))
      mainEditor.bind()

      // Store all editors for save
      this.#extendedEditor = new PolicyEditor(
        fragment.querySelector<HTMLElement>('#policy-tab-advanced')!,
        extSchema
      )
      // Override: we manage the fields manually, so just store references
      ;(this as any)._omkEditors = [deviceEditor, cryptoEditor, mainEditor]

      // Tab switching
      const tabBasic = fragment.querySelector<HTMLElement>('#tab-basic')!
      const tabAdvanced = fragment.querySelector<HTMLElement>('#tab-advanced')!
      const contentBasic = fragment.querySelector<HTMLElement>('#policy-tab-basic')!
      const contentAdvanced = fragment.querySelector<HTMLElement>('#policy-tab-advanced')!

      tabBasic.onclick = () => {
        this.#activeTab = 'basic'
        tabBasic.classList.add('active')
        tabAdvanced.classList.remove('active')
        contentBasic.style.display = ''
        contentAdvanced.style.display = 'none'
      }
      tabAdvanced.onclick = () => {
        this.#activeTab = 'advanced'
        tabAdvanced.classList.add('active')
        tabBasic.classList.remove('active')
        contentBasic.style.display = 'none'
        contentAdvanced.style.display = ''
      }
    }

    fragment.querySelector<MdOutlinedButton>('#close-default-policy')!.onclick = () => this.close()
    fragment.querySelector<MdFilledButton>('#save-default-policy')!.onclick = () => this.#save()

    return fragment
  }

  /** Create a sub-schema from the extended schema containing only the given keys */
  #getSubSchema(keys: string[]): import('../config').PolicySchema {
    const extSchema = (this.#config as ConfigOhMyKeyMint).extendedPolicySchema
    const fields: Record<string, import('../config').PolicyFieldMeta> = {}
    for (const [key, meta] of extSchema.getFields()) {
      if (keys.includes(key)) fields[key] = meta
    }
    return new (this.#config.constructor as any).policySchema.constructor(fields)
  }

  initAnimation(): void {
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  show(): void {
    const configData = this.#config.get()
    const policy = configData.default_policy ?? {}

    // Fill basic fields
    this.#policyEditor?.setPolicy(policy)

    // Fill OMK advanced fields
    if (this.#config instanceof ConfigOhMyKeyMint) {
      const editors = (this as any)._omkEditors as PolicyEditor[]
      if (editors) {
        // Device fields
        const devicePolicy: Record<string, string> = {}
        for (const key of ['brand', 'device', 'manufacturer', 'model', 'product', 'serial']) {
          if (policy[key]) devicePolicy[key] = policy[key]
        }
        editors[0].setPolicy(devicePolicy)

        // Crypto fields
        const cryptoPolicy: Record<string, string> = {}
        for (const key of ['root_kek_seed', 'kak_seed', 'shared_secret_seed', 'shared_secret_nonce']) {
          if (policy[key]) cryptoPolicy[key] = policy[key]
        }
        editors[1].setPolicy(cryptoPolicy)

        // Main/injector fields
        const mainPolicy: Record<string, string> = {}
        if (policy.log_level) mainPolicy.log_level = policy.log_level
        editors[2].setPolicy(mainPolicy)
      }
    }

    this.#dialog?.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  #save(): void {
    if (!this.#policyEditor?.isValid()) return

    const basicPolicy = this.#policyEditor?.getPolicy()
    const configData = this.#config.get()

    if (this.#config instanceof ConfigOhMyKeyMint) {
      // Merge all OMK editor values
      const merged: Record<string, string> = { ...(basicPolicy ?? {}) }
      const editors = (this as any)._omkEditors as PolicyEditor[]
      if (editors) {
        for (const editor of editors) {
          const p = editor.getPolicy()
          if (p) Object.assign(merged, p)
        }
      }
      configData.default_policy = merged
    } else {
      if (basicPolicy) {
        configData.default_policy = basicPolicy
      } else {
        delete configData.default_policy
      }
    }

    this.#config.write()
    this.close()
  }
}
