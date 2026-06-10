import { File } from './file'
import { Config, PolicySchema } from './config'
import type { ConfigData } from './config'
import { parse, stringify } from 'smol-toml'
import { OMK_TARGET_DIR } from './constant'

// ---------------------------------------------------------------------------
// Policy schema — fields that live in config.toml [trust]
// ---------------------------------------------------------------------------
const OMK_POLICY_SCHEMA = new PolicySchema({
  os_version: {
    label: 'OS Version',
    defaultValue: 'auto',
    options: ['auto'],
    placeholder: '15',
    validate: (v) => !v || v === 'auto' || /^\d+$/.test(v) || 'auto | number',
  },
  security_patch: {
    label: 'Security Patch',
    defaultValue: 'auto',
    options: ['auto', 'latest'],
    maxlength: 10,
    placeholder: 'YYYY-MM-DD',
    validate: (v) => !v || ['auto', 'latest'].includes(v) || /^\d{4}-\d{2}-\d{2}$/.test(v) || 'auto | latest | YYYY-MM-DD',
  },
  vb_key: {
    label: 'VB Key',
    defaultValue: 'auto',
    options: ['auto', 'random'],
    maxlength: 64,
    placeholder: '64 hex chars',
    textarea: true,
    validate: (v) => !v || ['auto', 'random'].includes(v) || /^[0-9a-f]{64}$/i.test(v) || 'auto | random | 64 hex chars',
  },
  vb_hash: {
    label: 'VB Hash',
    defaultValue: 'auto',
    options: ['auto', 'random'],
    maxlength: 64,
    placeholder: '64 hex chars',
    textarea: true,
    validate: (v) => !v || ['auto', 'random'].includes(v) || /^[0-9a-f]{64}$/i.test(v) || 'auto | random | 64 hex chars',
  },
})

// ---------------------------------------------------------------------------
// Extended policy schema — also exposes [main] / [device] fields that the
// user may want to tweak from the WebUI without touching raw TOML.
// ---------------------------------------------------------------------------
const OMK_FULL_POLICY_SCHEMA = new PolicySchema({
  os_version: {
    label: 'OS Version',
    defaultValue: 'auto',
    options: ['auto'],
    placeholder: '15',
    validate: (v) => !v || v === 'auto' || /^\d+$/.test(v) || 'auto | number',
  },
  security_patch: {
    label: 'Security Patch',
    defaultValue: 'auto',
    options: ['auto', 'latest'],
    maxlength: 10,
    placeholder: 'YYYY-MM-DD',
    validate: (v) => !v || ['auto', 'latest'].includes(v) || /^\d{4}-\d{2}-\d{2}$/.test(v) || 'auto | latest | YYYY-MM-DD',
  },
  vb_key: {
    label: 'VB Key',
    defaultValue: 'auto',
    options: ['auto', 'random'],
    maxlength: 64,
    placeholder: '64 hex chars',
    textarea: true,
    validate: (v) => !v || ['auto', 'random'].includes(v) || /^[0-9a-f]{64}$/i.test(v) || 'auto | random | 64 hex chars',
  },
  vb_hash: {
    label: 'VB Hash',
    defaultValue: 'auto',
    options: ['auto', 'random'],
    maxlength: 64,
    placeholder: '64 hex chars',
    textarea: true,
    validate: (v) => !v || ['auto', 'random'].includes(v) || /^[0-9a-f]{64}$/i.test(v) || 'auto | random | 64 hex chars',
  },
  /* ------- [device] section ------- */
  brand: {
    label: 'Device Brand',
    defaultValue: '',
    placeholder: 'google',
    validate: (v) => true,
  },
  device: {
    label: 'Device Name',
    defaultValue: '',
    placeholder: 'husky',
    validate: (v) => true,
  },
  manufacturer: {
    label: 'Manufacturer',
    defaultValue: '',
    placeholder: 'Google',
    validate: (v) => true,
  },
  model: {
    label: 'Model',
    defaultValue: '',
    placeholder: 'Pixel 8 Pro',
    validate: (v) => true,
  },
  product: {
    label: 'Product',
    defaultValue: '',
    placeholder: 'husky',
    validate: (v) => true,
  },
  serial: {
    label: 'Serial Number',
    defaultValue: '',
    placeholder: '',
    validate: (v) => true,
  },
})

export const OMK_EXTENDED_POLICY = OMK_FULL_POLICY_SCHEMA

// ---------------------------------------------------------------------------
// ConfigOhMyKeyMint
// ---------------------------------------------------------------------------
export class ConfigOhMyKeyMint extends Config {
  protected override readonly CONFIG_PATH = OMK_TARGET_DIR
  protected override readonly CONFIG_FILE = OMK_TARGET_DIR + '/config.toml'
  protected readonly INJECTOR_FILE = OMK_TARGET_DIR + '/injector.toml'

  protected readonly perAppConfig: boolean = false
  protected readonly appMode: boolean = false

  readonly policySchema = OMK_POLICY_SCHEMA
  readonly extendedPolicySchema = OMK_FULL_POLICY_SCHEMA

  // Raw TOML objects — preserved across read/write so we never lose sections
  #injector: Record<string, unknown> | null = null
  #omkConfig: Record<string, unknown> | null = null

  // ------------------------------------------------------------------
  // read — parse both TOML files, extract target + policy, keep raw data
  // ------------------------------------------------------------------
  override async read(): Promise<void> {
    if (import.meta.env.DEV) {
      this.set({
        default_policy: {
          os_version: '15',
          security_patch: 'auto',
          vb_key: 'auto',
          vb_hash: 'auto',
        },
        target: [
          'io.github.vvb2060.keyattestation',
          'com.google.android.gms',
        ],
      })
      // Simulate raw injector structure for dev mode
      this.#injector = {
        scoop: ['io.github.vvb2060.keyattestation', 'com.google.android.gms'],
        main: { enabled: true, log_level: 'debug' },
        filter: {
          enabled: true,
          deny_packages: [],
          block_android_package: true,
          allow_unknown_package: false,
        },
        intercept: {
          get_security_level: true,
          get_key_entry: true,
          update_subcomponent: true,
          list_entries: true,
          delete_key: true,
          grant: true,
          ungrant: true,
          get_number_of_entries: true,
          list_entries_batched: true,
          get_supplementary_attestation_info: true,
        },
      } as Record<string, unknown>
      this.#omkConfig = {
        main: { backend: 'Injector', force_skip_system_biometric_hat_verification: false },
        trust: { os_version: 15, security_patch: 'auto', vb_key: 'auto', vb_hash: 'auto' },
        crypto: {
          root_kek_seed: 'a'.repeat(64),
          kak_seed: 'b'.repeat(64),
          shared_secret_seed: 'c'.repeat(64),
          shared_secret_nonce: 'd'.repeat(64),
        },
        device: {
          brand: 'google', device: 'husky', manufacturer: 'Google',
          model: 'Pixel 8 Pro', product: 'husky', serial: '',
        },
      } as Record<string, unknown>
      return
    }

    const data: ConfigData = {}

    // --- injector.toml ---
    try {
      const raw = await File.read(this.INJECTOR_FILE)
      this.#injector = parse(raw) as Record<string, unknown>
      data.target = (this.#injector.scoop as string[]) ?? []
    } catch {
      this.#injector = null
      data.target = []
    }

    // --- config.toml ---
    try {
      const raw = await File.read(this.CONFIG_FILE)
      this.#omkConfig = parse(raw) as Record<string, unknown>
      const trust = this.#omkConfig.trust as Record<string, unknown> | undefined
      if (trust) {
        const policy: Record<string, string> = {}
        for (const key of ['os_version', 'security_patch', 'vb_key', 'vb_hash']) {
          if (trust[key] !== undefined) {
            policy[key] = String(trust[key])
          }
        }
        if (Object.keys(policy).length > 0) {
          data.default_policy = policy
        }
      }
    } catch {
      this.#omkConfig = null
    }

    if (!data.default_policy) {
      data.default_policy = { os_version: 'auto', security_patch: 'auto', vb_key: 'auto', vb_hash: 'auto' }
    }

    this.set(data)
  }

  // ------------------------------------------------------------------
  // write — merge changes back into raw TOML objects and write full files
  // ------------------------------------------------------------------
  override async write(): Promise<void> {
    const data = this.get()

    // --- injector.toml: preserve all sections, only replace scoop ---
    const injector = (this.#injector ?? {}) as Record<string, unknown>
    injector.scoop = data.target ?? []
    this.#injector = injector
    await File.write(this.INJECTOR_FILE, stringify(this.#injector))

    // --- config.toml: preserve all sections, only replace [trust] values ---
    const omkConfig = (this.#omkConfig ?? {}) as Record<string, unknown>
    const trust = (omkConfig.trust ?? {}) as Record<string, unknown>
    const policy = data.default_policy ?? {}

    // Reset fields that are no longer present in policy (user cleared them)
    const trustKeys = ['os_version', 'security_patch', 'vb_key', 'vb_hash']
    for (const key of trustKeys) {
      if (policy[key] !== undefined && policy[key] !== '') {
        if (key === 'os_version') {
          const osVer = policy.os_version as string
          trust.os_version = /^\d+$/.test(osVer) ? parseInt(osVer, 10) : osVer
        } else {
          (trust as Record<string, unknown>)[key] = policy[key]
        }
      } else {
        delete trust[key]
      }
    }

    omkConfig.trust = trust
    this.#omkConfig = omkConfig
    await File.write(this.CONFIG_FILE, stringify(this.#omkConfig))
  }

  // ------------------------------------------------------------------
  // Extended data accessors — raw TOML objects for full editing
  // ------------------------------------------------------------------
  getInjectorData(): Record<string, unknown> | null {
    return this.#injector
  }

  setInjectorData(data: Record<string, unknown>): void {
    this.#injector = data
    data.target = (data.scoop as string[]) ?? []
  }

  getOmkConfigData(): Record<string, unknown> | null {
    return this.#omkConfig
  }

  setOmkConfigData(data: Record<string, unknown>): void {
    this.#omkConfig = data
    // Sync trust → default_policy
    const trust = (data.trust ?? {}) as Record<string, unknown>
    if (Object.keys(trust).length > 0) {
      const policy: Record<string, string> = {}
      for (const key of ['os_version', 'security_patch', 'vb_key', 'vb_hash']) {
        if (trust[key] !== undefined) policy[key] = String(trust[key])
      }
      if (Object.keys(policy).length > 0) {
        const cur = this.get()
        cur.default_policy = policy
        this.set(cur)
      }
    }
  }

  get keyboxPath(): string {
    return OMK_TARGET_DIR + '/keybox.xml'
  }
}
