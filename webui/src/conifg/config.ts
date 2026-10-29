export interface Policy {
  os_patch?: string
  vendor_patch?: string
  boot_patch?: string
  [key: string]: string | boolean | undefined
}

export interface PolicyEditorApi {
  getPolicy(): Policy | null
  setPolicy(policy: Policy | null): void
  getField(key: string): HTMLElement | undefined
}

export interface TextFieldMeta {
  type?: 'text'
  label?: string
  required?: boolean
  defaultValue?: string
  options?: string[]
  maxlength?: number
  placeholder?: string
  textarea?: boolean
  validate: (value: string) => boolean | string
  globalPolicy?: boolean
  perAppPolicy?: boolean
}

export interface BooleanFieldMeta {
  type: 'boolean'
  label: string
  defaultValue?: boolean
  globalPolicy?: boolean
  perAppPolicy?: boolean
}

export interface ButtonFieldMeta {
  type: 'button'
  label: string
  variant?: 'primary' | 'secondary' | 'tertiary' | 'error'
  disabled?: () => boolean
  onClick: (editor: PolicyEditorApi, context: 'global' | 'perApp') => void
  globalPolicy?: boolean
  perAppPolicy?: boolean
}

export interface SelectFieldMeta {
  type: 'select'
  label: string
  options: string[]
  optionLabels?: Record<string, string>
  defaultValue?: string
  onLoad?: (context: 'global' | 'perApp', current: string | undefined) => string[]
  onSelect?: (value: string, editor: PolicyEditorApi, context: 'global' | 'perApp') => string | void
  globalPolicy?: boolean
  perAppPolicy?: boolean
}

export type PolicyFieldMeta = TextFieldMeta | BooleanFieldMeta | ButtonFieldMeta | SelectFieldMeta

export function snakeToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export class PolicySchema {
  readonly #fields: Map<string, PolicyFieldMeta>

  constructor(fields: Record<string, PolicyFieldMeta>) {
    this.#fields = new Map(Object.entries(fields))
  }

  getField(key: string): PolicyFieldMeta | undefined {
    return this.#fields.get(key)
  }

  getFields(context?: 'global' | 'perApp'): [string, PolicyFieldMeta][] {
    const entries = [...this.#fields.entries()]
    if (!context) return entries
    const flag = context === 'global' ? 'globalPolicy' : 'perAppPolicy'
    return entries.filter(([, meta]) => meta[flag] ?? true)
  }
}

export interface ConfigData {
  default_policy?: Policy
  target?: string[]
  [section: string]: Policy | string[] | undefined
}

export abstract class Config {
  abstract readonly identity: string

  protected readonly CONFIG_PATH: string = '/data/adb/tricky_store'

  protected readonly perAppConfig: boolean = true
  protected readonly moduleVisible: boolean = false

  #data: ConfigData = {}
  abstract readonly policySchema: PolicySchema

  abstract read(): Promise<void>
  abstract write(): Promise<void>

  get(): ConfigData
  get(section: string): Policy | string[] | undefined
  get(section?: string): ConfigData | Policy | string[] | undefined {
    if (section === undefined) return this.#data
    return this.#data[section]
  }

  set(data: ConfigData): void
  set(section: string, key: string, value: string): void
  set(section: string, value: string[] | Policy | undefined): void
  set(section: string | ConfigData, key?: string | string[] | Policy, value?: string): void {
    if (typeof section === 'object') {
      this.#data = section
    } else if (value !== undefined) {
      if (!(section in this.#data) || Array.isArray(this.#data[section])) {
        this.#data[section] = {}
      }
      (this.#data[section] as Record<string, string>)[key as string] = value
    } else if (key === undefined) {
      delete this.#data[section]
    } else {
      this.#data[section] = key as string[] | Policy
    }
  }

  removeMatch(section: string, predicate: (value: string) => boolean): string[] {
    const arr = this.#data[section]
    if (!Array.isArray(arr)) return []
    const removed = arr.filter(predicate)
    this.#data[section] = arr.filter(v => !predicate(v))
    return removed
  }

  replaceMatch(section: string, predicate: (value: string) => boolean, newValue: string): boolean {
    const arr = this.#data[section]
    if (!Array.isArray(arr)) return false
    const idx = arr.findIndex(predicate)
    if (idx === -1) return false
    arr[idx] = newValue
    return true
  }

  push(section: string, value: string): void {
    if (!(section in this.#data) || !Array.isArray(this.#data[section])) {
      this.#data[section] = []
    }
    (this.#data[section] as string[]).push(value)
  }

  pop(section: string, value?: string): string | undefined {
    const arr = this.#data[section]
    if (!Array.isArray(arr)) return undefined

    let removed: string | undefined
    if (value === undefined) {
      removed = arr.pop()
    } else {
      const idx = arr.indexOf(value)
      if (idx !== -1) {
        removed = arr.splice(idx, 1)[0]
      }
    }

    if (removed && section === 'target') {
      const pkgName = removed.replace(/[!?]$/, '')
      delete this.#data[pkgName]
    }

    return removed
  }

  get configPath(): string {
    return this.CONFIG_PATH
  }

  get supportsPerAppConfig(): boolean {
    return this.perAppConfig
  }

  get isModuleVisible(): boolean {
    return this.moduleVisible
  }
}
