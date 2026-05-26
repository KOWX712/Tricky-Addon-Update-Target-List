import { File } from './file'
import { TS_PATH } from './constant'

export interface Policy {
  os_patch?: string
  vendor_patch?: string
  boot_patch?: string
}

export interface ConfigData {
  default_policy?: Policy
  target?: string[]
  [section: string]: Policy | string[] | undefined
}

export const MIN_SUPPORTED_VERSION = 246

const CONFIG_PATH = TS_PATH + '/config.ini'

function parseConfig(raw: string): ConfigData {
  const config: ConfigData = {}
  let section: string | null = null

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue

    const sectionMatch = trimmed.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      config[section] = section === 'target' ? [] : {}
      continue
    }

    if (!section) continue

    if (section === 'target') {
      (config.target as string[]).push(trimmed)
    } else {
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim()
        const sectionData = config[section] as Record<string, string>
        sectionData[key] = value
      }
    }
  }

  return config
}

function serializeConfig(config: ConfigData): string {
  const lines: string[] = []

  for (const [section, data] of Object.entries(config)) {
    if (data === undefined) continue
    lines.push(`[${section}]`)

    if (section === 'target' && Array.isArray(data)) {
      for (const entry of data) {
        lines.push(entry)
      }
    } else if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data as Record<string, string>)) {
        lines.push(`${key} = ${value}`)
      }
    }
  }

  return lines.join('\n')
}

export class Config {
  #data: ConfigData = {}
  readonly supportsPerAppConfig: boolean = true

  async read(): Promise<void> {
    if (import.meta.env.DEV) {
      this.#data = {
        default_policy: { os_patch: 'no', vendor_patch: 'no', boot_patch: 'no' },
        target: [
          'io.github.vvb2060.keyattestation',
          'io.github.vvb2060.mahoshojo?',
          'com.google.android.gms!',
          'com.example.banking',
          'com.example.wallet!',
          'com.example.social?',
        ],
        'com.google.android.gms': { os_patch: 'prop', vendor_patch: 'YYYYMM05', boot_patch: '20260505' },
        'com.example.banking': { os_patch: 'prop', vendor_patch: '20260601', boot_patch: 'prop' },
      }
      return
    }
    try {
      const raw = await File.read(CONFIG_PATH)
      this.#data = parseConfig(raw)
    } catch {
      this.#data = {
        default_policy: { os_patch: 'no', vendor_patch: 'no', boot_patch: 'no' },
        target: [],
      }
    }
  }

  async write(): Promise<void> {
    const raw = serializeConfig(this.#data)
    await File.write(CONFIG_PATH, raw)
  }

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
    if (value === undefined) return arr.pop()
    const idx = arr.indexOf(value)
    return idx !== -1 ? arr.splice(idx, 1)[0] : undefined
  }

  static support(versionCode: number): boolean {
    return versionCode >= MIN_SUPPORTED_VERSION
  }
}
