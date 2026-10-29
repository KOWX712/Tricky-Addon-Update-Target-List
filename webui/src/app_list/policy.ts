import type { MdOutlinedTextField, MdOutlinedSelect, MdSwitch } from '@material/web/all'
import type { Policy, PolicySchema, TextFieldMeta } from '../conifg/config'
import { snakeToLabel } from '../conifg/config'
import { i18n } from '../i18n'

export class PolicyEditor {
  readonly #fields: Map<string, MdOutlinedTextField | MdSwitch | HTMLElement>
  readonly #schema: PolicySchema
  readonly #context: 'global' | 'perApp'

  constructor(fieldsEl: HTMLElement, schema: PolicySchema, context: 'global' | 'perApp' = 'global') {
    this.#schema = schema
    this.#context = context
    this.#fields = new Map()
    for (const [key] of schema.getFields()) {
      const field = fieldsEl.querySelector<HTMLElement>(`.policy-${key}`)
      if (field) this.#fields.set(key, field)
    }
  }

  getField(key: string): MdOutlinedTextField | MdSwitch | HTMLElement | undefined {
    return this.#fields.get(key)
  }

  getSchema(): PolicySchema {
    return this.#schema
  }

  bind(): void {
    for (const [key, meta] of this.#schema.getFields()) {
      if (meta.type === 'button') {
        const btn = this.#fields.get(key) as HTMLElement | undefined
        if (!btn) continue
        btn.onclick = () => {
          meta.onClick(this, this.#context)
          this.refreshSelects()
        }
        continue
      }

      if (meta.type === 'boolean') {
        continue
      }

      if (meta.type === 'select') {
        if (!meta.onSelect) continue
        const field = this.#fields.get(key) as MdOutlinedSelect | undefined
        if (!field) continue
        field.addEventListener('change', () => {
          const replacement = meta.onSelect!(field.value, this, this.#context)
          this.refreshSelects(typeof replacement === 'string' ? replacement : undefined)
        })
        continue
      }

      // text field
      const field = this.#fields.get(key) as MdOutlinedTextField | undefined
      if (!field) continue
      const textMeta = meta as TextFieldMeta
      field.oninput = () => {
        const val = field.value.trim().toLowerCase()
        field.value = val
        const result = textMeta.validate(val)
        if (result === true) {
          field.error = false
        } else {
          field.error = true
          if (typeof result === 'string') field.errorText = result
        }
      }
    }
  }

  isValid(): boolean {
    for (const [key, meta] of this.#schema.getFields()) {
      if (meta.type !== 'text') continue
      const field = this.#fields.get(key) as MdOutlinedTextField | undefined
      if (!field) continue
      const val = field.value.trim()
      if (val && (meta as TextFieldMeta).validate(val) !== true) return false
    }
    return true
  }

  static #renderCount = 0

  static html(schema: PolicySchema, context?: 'global' | 'perApp'): string {
    const instanceId = ++PolicyEditor.#renderCount
    const fields = schema.getFields(context).map(([key, meta]) => {
      if (meta.type === 'button') {
        const variant = meta.variant && meta.variant !== 'primary' ? ` ${meta.variant}` : ''
        const disabled = meta.disabled?.() ? ' disabled' : ''
        return `<md-filled-button class="full-width-button policy-${key}${variant}"${disabled}>${i18n.t(meta.label)}</md-filled-button>`
      }

      if (meta.type === 'boolean') {
        const fieldId = `policy-${instanceId}-${key}`
        return `<label class="switch-item outlined" for="${fieldId}">
          <md-ripple></md-ripple>
          <span>${i18n.t(meta.label)}</span>
          <md-switch icons="true" id="${fieldId}" class="policy-${key}" ${meta.defaultValue ? ' selected' : ''}></md-switch>
        </label>`
      }

      if (meta.type === 'select') {
        const opts = meta.onLoad ? meta.onLoad(context ?? 'global', undefined) : meta.options
        const selectedOpt = (context ?? 'global') === 'global'
          ? opts[0]
          : (meta.defaultValue && opts.includes(meta.defaultValue) ? meta.defaultValue : opts[0])
        const options = opts.map(opt =>
          `<md-select-option value="${opt}" display-text="${i18n.t(meta.optionLabels?.[opt] ?? opt)}"${opt === selectedOpt ? ' selected' : ''}>
            <div slot="headline">${i18n.t(meta.optionLabels?.[opt] ?? opt)}</div>
          </md-select-option>`,
        ).join('\n')
        return `<md-outlined-select class="policy-${key}" label="${i18n.t(meta.label)}">
          ${options}
        </md-outlined-select>`
      }

      // text field
      const textMeta = meta as TextFieldMeta
      const options = textMeta.options?.length ? ` [${textMeta.options.join('/')}]` : ''
      const hint = textMeta.placeholder ?? key
      const displayLabel = i18n.t(textMeta.label ?? snakeToLabel(key))
      const textarea = textMeta.textarea ? ' type="textarea" rows="4"' : ''
      const maxlength = textMeta.maxlength != null ? ` maxlength="${textMeta.maxlength}"` : ''
      return `<md-outlined-text-field class="policy-${key}" label="${displayLabel}" placeholder="${hint}${options}" autocapitalize="none"${maxlength}${textarea}></md-outlined-text-field>`
    }).join('\n')
    return fields
  }

  refreshSelects(preferred?: string): void {
    for (const [key, meta] of this.#schema.getFields()) {
      if (meta.type !== 'select' || !meta.onLoad) continue
      const field = this.#fields.get(key) as MdOutlinedSelect | undefined
      if (!field) continue
      const current = field.value
      const options = meta.onLoad(this.#context, current)
      const fallback = meta.defaultValue && options.includes(meta.defaultValue) ? meta.defaultValue : options[0]
      const selected = preferred !== undefined
        ? (options.includes(preferred) ? preferred : fallback)
        : this.#context === 'global'
          ? (options[0] ?? '')
          : (options.includes(current) ? current : fallback)
      field.innerHTML = options.map(opt =>
        `<md-select-option value="${opt}" display-text="${i18n.t(meta.optionLabels?.[opt] ?? opt)}"${opt === selected ? ' selected' : ''}>
          <div slot="headline">${i18n.t(meta.optionLabels?.[opt] ?? opt)}</div>
        </md-select-option>`,
      ).join('\n')
      requestAnimationFrame(() => {
        const marked = field.querySelector<HTMLElement>('md-select-option[selected]')
        if (marked) field.value = marked.getAttribute('value') ?? ''
      })
    }
  }

  setPolicy(policy: Policy | null): void {
    for (const [key, meta] of this.#schema.getFields()) {
      if (meta.type === 'button') {
        const btn = this.#fields.get(key) as HTMLButtonElement | undefined
        if (btn) btn.disabled = !!meta.disabled?.()
        continue
      }

      if (meta.type === 'boolean') {
        const field = this.#fields.get(key) as MdSwitch | undefined
        if (!field) continue
        field.selected = policy?.[key] === true || policy?.[key] === 'true'
        continue
      }

      if (meta.type === 'select') {
        const field = this.#fields.get(key) as MdOutlinedSelect | undefined
        if (!field) continue
        const value = String(policy?.[key] ?? meta.defaultValue ?? '')
        field.value = value
        for (const opt of field.querySelectorAll<HTMLElement>('md-select-option')) {
          if (opt.getAttribute('value') === value) opt.setAttribute('selected', '')
          else opt.removeAttribute('selected')
        }
        continue
      }

      const field = this.#fields.get(key) as MdOutlinedTextField | undefined
      if (!field) continue
      field.value = (policy?.[key] as string) ?? ''
      if ('error' in field) field.error = false
    }
  }

  getPolicy(): Policy | null {
    const policy: Policy = {}
    let hasValue = false
    for (const [key, meta] of this.#schema.getFields()) {
      if (meta.type === 'button') continue

      if (meta.type === 'boolean') {
        const field = this.#fields.get(key) as MdSwitch | undefined
        if (!field) continue
        policy[key] = field.selected
        if (field.selected) hasValue = true
        continue
      }

      if (meta.type === 'select') {
        const field = this.#fields.get(key) as MdOutlinedSelect | undefined
        if (!field) continue
        const val = field.value
        if (val) {
          policy[key] = val
          hasValue = true
        }
        continue
      }

      const val = (this.#fields.get(key) as MdOutlinedTextField | undefined)?.value.trim() ?? ''
      if (val) {
        policy[key] = val
        hasValue = true
      }
    }
    if (!hasValue || !this.isValid()) return null
    return policy
  }
}
