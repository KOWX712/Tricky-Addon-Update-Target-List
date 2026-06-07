import type { MdOutlinedTextField } from '@material/web/all'
import type { Policy, PolicySchema } from '../config'
import { snakeToLabel } from '../config'
import { i18n } from '../i18n'

export class PolicyEditor {
  readonly #fields: Map<string, MdOutlinedTextField>
  readonly #todayBtn: HTMLElement | null
  readonly #schema: PolicySchema

  constructor(fieldsEl: HTMLElement, schema: PolicySchema) {
    this.#schema = schema
    this.#fields = new Map()
    for (const [key] of schema.getFields()) {
      const field = fieldsEl.querySelector<MdOutlinedTextField>(`.policy-${key}`)
      if (field) this.#fields.set(key, field)
    }
    this.#todayBtn = fieldsEl.querySelector<HTMLElement>('#today-default-policy')
  }

  bind(): void {
    for (const [key, meta] of this.#schema.getFields()) {
      const field = this.#fields.get(key)
      if (!field) continue
      field.oninput = () => {
        const val = field.value.trim().toLowerCase()
        field.value = val
        const result = meta.validate(val)
        if (result === true) {
          field.error = false
        } else {
          field.error = true
          if (typeof result === 'string') field.errorText = result
        }
      }
    }

    if (this.#todayBtn) {
      this.#todayBtn.onclick = () => {
        const now8 = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        for (const [key, meta] of this.#schema.getFields()) {
          const field = this.#fields.get(key)
          if (!field) continue
          if (meta.maxlength === 6) {
            field.value = now8.slice(0, 6)
          } else if (meta.maxlength && meta.maxlength >= 8) {
            field.value = now8
          }
          field.error = false
        }
      }
    }
  }

  isValid(): boolean {
    for (const [key, meta] of this.#schema.getFields()) {
      const field = this.#fields.get(key)
      if (!field) continue
      const val = field.value.trim()
      if (val && meta.validate(val) !== true) return false
    }
    return true
  }

  static html(schema: PolicySchema): string {
    const fields = schema.getFields().map(([key, meta]) => {
      const options = meta.options?.length ? ` (${meta.options.join(', ')})` : ''
      const hint = meta.placeholder ?? key
      const displayLabel = meta.label ?? snakeToLabel(key)
      return `<md-outlined-text-field class="policy-${key}" label="${displayLabel}" placeholder="${hint}${options}" autocapitalize="none" maxlength="${meta.maxlength ?? ''}"></md-outlined-text-field>`
    }).join('\n')
    return `${fields}\n<md-outlined-button class="full-width-button" id="today-default-policy">${i18n.t('functional_button_today')}</md-outlined-button>`
  }

  setPolicy(policy: Policy | null): void {
    for (const [key] of this.#schema.getFields()) {
      const field = this.#fields.get(key)
      if (!field) continue
      field.value = policy?.[key] ?? ''
      field.error = false
    }
  }

  getPolicy(): Policy | null {
    const policy: Policy = {}
    let hasValue = false
    for (const [key] of this.#schema.getFields()) {
      const val = this.#fields.get(key)?.value.trim() ?? ''
      if (val) {
        policy[key] = val
        hasValue = true
      }
    }
    if (!hasValue || !this.isValid()) return null
    return policy
  }
}
