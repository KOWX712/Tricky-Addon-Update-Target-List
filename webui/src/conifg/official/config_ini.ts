import type { MdOutlinedTextField } from '@material/web/all'
import { file } from '../../file'
import { isDev } from '../../utils/dev'
import { Config, PolicySchema } from '../config'
import type { ConfigData } from '../config'

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
      for (const [key, value] of Object.entries(data as Record<string, string | boolean>)) {
        lines.push(`${key} = ${value}`)
      }
    }
  }

  return lines.join('\n')
}

const MIN_SUPPORTED_VERSION = 246

const INI_POLICY_SCHEMA: PolicySchema = new PolicySchema({
  os_patch: {
    defaultValue: 'no',
    options: ['prop', 'no'],
    maxlength: 6,
    placeholder: 'YYYYMM',
    validate: (v) => !v || v === 'prop' || v === 'no' || /^\d{6}$/.test(v) || 'YYYYMM | prop | no',
  },
  vendor_patch: {
    defaultValue: 'no',
    options: ['prop', 'no'],
    maxlength: 8,
    placeholder: 'YYYYMMDD',
    validate: (v) => !v || v === 'prop' || v === 'no' || /^\d{8}$/.test(v) || 'YYYYMMDD | prop | no',
  },
  boot_patch: {
    defaultValue: 'no',
    options: ['prop', 'no'],
    maxlength: 8,
    placeholder: 'YYYYMMDD',
    validate: (v) => !v || v === 'prop' || v === 'no' || /^\d{8}$/.test(v) || 'YYYYMMDD | prop | no',
  },
  _today: {
    type: 'button',
    label: 'functional_button_today',
    onClick: (editor) => {
      const now8 = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const setDate = (key: string) => {
        const el = editor.getField(key) as MdOutlinedTextField | undefined
        if (!el) return
        const maxlength = parseInt(el.getAttribute('maxlength') ?? '', 10)
        if (maxlength === 6) {
          el.value = now8.slice(0, 6)
        } else if (maxlength >= 8) {
          el.value = now8
        }
      }
      setDate('os_patch')
      setDate('vendor_patch')
      setDate('boot_patch')
    },
  },
})

export class ConfigIni extends Config {
  override readonly identity: string = 'TS'

  protected readonly CONFIG_FILE: string = this.CONFIG_PATH + '/config.ini'

  override readonly policySchema: PolicySchema = INI_POLICY_SCHEMA

  override async read(): Promise<void> {
    if (isDev()) {
      this.set({
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
      })
      return
    }
    try {
      const raw = await file.read(this.CONFIG_FILE)
      this.set(parseConfig(raw))
    } catch {
      this.set({
        default_policy: { os_patch: 'no', vendor_patch: 'no', boot_patch: 'no' },
        target: [],
      })
    }
  }

  override async write(): Promise<void> {
    const raw = serializeConfig(this.get())
    await file.write(this.CONFIG_FILE, raw)
  }

  static support(versionCode: number): boolean {
    return versionCode >= MIN_SUPPORTED_VERSION
  }
}
