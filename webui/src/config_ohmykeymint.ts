import { File } from './file'
import { Config, PolicySchema } from './config'
import type { ConfigData } from './config'
import { parse, stringify } from 'smol-toml'

const OMK_POLICY_SCHEMA = new PolicySchema({
  os_version: {
    label: 'OS Version',
    defaultValue: 'auto',
    options: ['auto'],
    placeholder: 'e.g. 15 or auto',
    validate: (v) => !v || v === 'auto' || /^\d+$/.test(v) || 'Expected a number or auto',
  },
  security_patch: {
    label: 'Security Patch',
    defaultValue: 'auto',
    options: ['auto', 'latest'],
    maxlength: 10,
    placeholder: 'auto / latest / YYYY-MM-DD',
    validate: (v) => !v || ['auto', 'latest'].includes(v) || /^\d{4}-\d{2}-\d{2}$/.test(v) || 'Expected auto, latest, or YYYY-MM-DD',
  },
  vb_key: {
    label: 'VB Key',
    defaultValue: 'auto',
    options: ['auto', 'random'],
    maxlength: 64,
    placeholder: 'auto / random / 64 hex chars',
    validate: (v) => !v || ['auto', 'random'].includes(v) || /^[0-9a-f]{64}$/i.test(v) || 'Expected 64 hex characters, auto, or random',
  },
  vb_hash: {
    label: 'VB Hash',
    defaultValue: 'auto',
    options: ['auto', 'random'],
    maxlength: 64,
    placeholder: 'auto / random / 64 hex chars',
    validate: (v) => !v || ['auto', 'random'].includes(v) || /^[0-9a-f]{64}$/i.test(v) || 'Expected 64 hex characters, auto, or random',
  },
})

export class ConfigOhMyKeyMint extends Config {
  override readonly CONFIG_PATH = '/data/misc/keystore/omk'
  override readonly CONFIG_FILE = this.CONFIG_PATH + '/config.toml'
  readonly INJECTOR_FILE = this.CONFIG_PATH + '/injector.toml'

  readonly supportsPerAppConfig = false as const
  readonly policySchema = OMK_POLICY_SCHEMA

  #injector: Record<string, unknown> | null = null
  #omkConfig: Record<string, unknown> | null = null

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
      return
    }

    const data: ConfigData = {}

    try {
      const raw = await File.read(this.INJECTOR_FILE)
      this.#injector = parse(raw) as Record<string, unknown>
      data.target = (this.#injector.scoop as string[]) ?? []
    } catch {
      this.#injector = null
      data.target = []
    }

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

  override async write(): Promise<void> {
    const data = this.get()

    const injector = this.#injector ?? {}
    injector.scoop = data.target ?? []
    this.#injector = injector
    await File.write(this.INJECTOR_FILE, stringify(this.#injector))

    const omkConfig = this.#omkConfig ?? {}
    const trust = (omkConfig.trust ?? {}) as Record<string, unknown>
    const policy = data.default_policy ?? {}

    if (policy.security_patch !== undefined) trust.security_patch = policy.security_patch
    if (policy.vb_key !== undefined) trust.vb_key = policy.vb_key
    if (policy.vb_hash !== undefined) trust.vb_hash = policy.vb_hash
    if (policy.os_version !== undefined) {
      trust.os_version = /^\d+$/.test(policy.os_version)
        ? parseInt(policy.os_version, 10)
        : policy.os_version
    }

    omkConfig.trust = trust
    this.#omkConfig = omkConfig
    await File.write(this.CONFIG_FILE, stringify(this.#omkConfig))
  }
}
