import { File } from './file'
import { Config, PolicySchema } from './config'
import type { ConfigData } from './config'

interface TeeProfile {
  apps?: unknown
  patchLevel?: unknown
  osVersion?: unknown
  [key: string]: unknown
}

interface TeeConfig {
  version: number
  profiles: Record<string, TeeProfile>
  [key: string]: unknown
}

const PATCH_LEVEL_PATTERN = /^(?:no|today|harvested|system_property|(?:\d{4}|YYYY)-(?:\d{2}|MM)(?:-(?:\d{2}|DD))?)$/
const OS_VERSION_PATTERN = /^(?:no|harvested|system_property|\d+(?:\.\d+){0,2})$/
const IDENTITY_FIELDS = ['brand', 'device', 'product', 'manufacturer', 'model', 'serial', 'imei', 'meid', 'imei2'] as const

const TEE_SIMULATOR_POLICY_SCHEMA = new PolicySchema({
  os_patch: {
    label: 'System Patch',
    defaultValue: 'today',
    options: ['today', 'harvested', 'system_property', 'no'],
    placeholder: 'YYYY-MM-DD',
    validate: (v) => !v || PATCH_LEVEL_PATTERN.test(v) || 'today | harvested | system_property | no | date',
  },
  vendor_patch: {
    label: 'Vendor Patch',
    defaultValue: 'YYYY-MM-05',
    options: ['today', 'harvested', 'system_property', 'no'],
    placeholder: 'YYYY-MM-05',
    validate: (v) => !v || PATCH_LEVEL_PATTERN.test(v) || 'today | harvested | system_property | no | date',
  },
  boot_patch: {
    label: 'Boot Patch',
    defaultValue: 'YYYY-MM-05',
    options: ['today', 'harvested', 'system_property', 'no'],
    placeholder: 'YYYY-MM-05',
    validate: (v) => !v || PATCH_LEVEL_PATTERN.test(v) || 'today | harvested | system_property | no | date',
  },
  os_version: {
    label: 'OS Version',
    options: ['harvested', 'system_property', 'no'],
    placeholder: '16 or 16.0.0',
    validate: (v) => !v || OS_VERSION_PATTERN.test(v) || 'harvested | system_property | no | version',
  },
  brand: { label: 'Brand', validate: () => true },
  device: { label: 'Device', validate: () => true },
  product: { label: 'Product', validate: () => true },
  manufacturer: { label: 'Manufacturer', validate: () => true },
  model: { label: 'Model', validate: () => true },
  serial: { label: 'Serial', validate: () => true },
  imei: { label: 'IMEI', validate: () => true },
  meid: { label: 'MEID', validate: () => true },
  imei2: { label: 'IMEI 2', validate: () => true },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createDefaultConfig(): TeeConfig {
  return {
    version: 1,
    profiles: {
      default: {
        keybox: 'keybox.xml',
        patchLevel: { system: 'today', vendor: 'YYYY-MM-05', boot: 'YYYY-MM-05' },
        osVersion: '',
        brand: '', device: '', product: '', manufacturer: '', model: '',
        serial: '', imei: '', meid: '', imei2: '',
        apps: [],
      },
    },
  }
}

export class ConfigTeeSimulator extends Config {
  override readonly identity: string = 'TEES'

  protected override readonly CONFIG_PATH = '/data/adb/teesim'
  protected override readonly CONFIG_FILE = this.CONFIG_PATH + '/config.json'
  protected override readonly perAppConfig: boolean = false
  protected override readonly appMode: boolean = false
  protected override readonly moduleVisible: boolean = true

  override readonly policySchema = TEE_SIMULATOR_POLICY_SCHEMA

  #teeConfig: TeeConfig = createDefaultConfig()

  override async read(): Promise<void> {
    if (import.meta.env.DEV) {
      this.#teeConfig = createDefaultConfig()
      this.#teeConfig.profiles.default.apps = [
        'io.github.vvb2060.keyattestation',
        'com.google.android.gms',
        'com.android.vending',
      ]
    } else {
      try {
        const parsed: unknown = JSON.parse(await File.read(this.CONFIG_FILE))
        if (!isRecord(parsed) || !isRecord(parsed.profiles)) throw new Error('Invalid Tee Simulator config')
        const profiles = Object.fromEntries(
          Object.entries(parsed.profiles).filter(([, profile]) => isRecord(profile))
        ) as Record<string, TeeProfile>
        this.#teeConfig = {
          ...parsed,
          version: typeof parsed.version === 'number' ? parsed.version : 1,
          profiles,
        }
      } catch {
        this.#teeConfig = createDefaultConfig()
      }
    }

    const target: string[] = []
    const data: ConfigData = { target }
    const seenApps = new Set<string>()
    for (const profile of Object.values(this.#teeConfig.profiles)) {
      if (!Array.isArray(profile.apps)) continue
      for (const app of profile.apps) {
        if (typeof app === 'string' && !seenApps.has(app)) {
          seenApps.add(app)
          target.push(app)
        }
      }
    }

    const defaultProfile = this.#defaultProfile()
    const policy: Record<string, string> = {}
    const patchLevel = isRecord(defaultProfile.patchLevel) ? defaultProfile.patchLevel : {}
    for (const [policyKey, configKey] of [['os_patch', 'system'], ['vendor_patch', 'vendor'], ['boot_patch', 'boot']] as const) {
      if (patchLevel[configKey] !== undefined) policy[policyKey] = String(patchLevel[configKey])
    }
    if (defaultProfile.osVersion !== undefined) policy.os_version = String(defaultProfile.osVersion)
    for (const key of IDENTITY_FIELDS) {
      if (defaultProfile[key] !== undefined) policy[key] = String(defaultProfile[key])
    }
    data.default_policy = policy
    this.set(data)
  }

  override async write(): Promise<void> {
    const data = this.get()
    const defaultProfile = this.#defaultProfile()
    const policy = data.default_policy ?? {}
    const patchLevel: Record<string, string> = {}

    for (const [policyKey, configKey] of [['os_patch', 'system'], ['vendor_patch', 'vendor'], ['boot_patch', 'boot']] as const) {
      if (policy[policyKey] !== undefined) patchLevel[configKey] = String(policy[policyKey])
    }
    if (Object.keys(patchLevel).length > 0) defaultProfile.patchLevel = patchLevel
    else delete defaultProfile.patchLevel

    if (policy.os_version !== undefined) defaultProfile.osVersion = String(policy.os_version)
    else delete defaultProfile.osVersion
    for (const key of IDENTITY_FIELDS) {
      if (policy[key] !== undefined) defaultProfile[key] = String(policy[key])
      else delete defaultProfile[key]
    }

    const remainingApps = new Set((data.target ?? []).filter((app): app is string => typeof app === 'string'))
    for (const profile of Object.values(this.#teeConfig.profiles)) {
      const apps = Array.isArray(profile.apps) ? profile.apps : []
      profile.apps = apps.filter((app): app is string => typeof app === 'string' && remainingApps.delete(app))
    }
    defaultProfile.apps = [...(Array.isArray(defaultProfile.apps) ? defaultProfile.apps : []), ...remainingApps]

    await File.write(this.CONFIG_FILE, JSON.stringify(this.#teeConfig, null, 2))
  }

  #defaultProfile(): TeeProfile {
    const existing = this.#teeConfig.profiles.default
    if (isRecord(existing)) return existing as TeeProfile
    const profile = createDefaultConfig().profiles.default
    this.#teeConfig.profiles.default = profile
    return profile
  }
}
