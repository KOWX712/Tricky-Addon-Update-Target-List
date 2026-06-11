import { File } from './file'
import { Config } from './config'
import type { ConfigData, Policy } from './config'

function parseTarget(raw: string): string[] {
  const targets: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    targets.push(trimmed)
  }
  return targets
}

function stripDay(value: string): string {
  return /^\d{8}$/.test(value) ? value.slice(0, 6) : value
}

function parseSecurityPatch(raw: string): Policy | null {
  const policy: Policy = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === 0) continue

    const key = eqIdx > 0 ? trimmed.slice(0, eqIdx).trim() : 'all'
    const value = eqIdx > 0 ? trimmed.slice(eqIdx + 1).trim() : trimmed

    switch (key) {
      case 'system':
        policy.os_patch = value
        break
      case 'boot':
        policy.boot_patch = value
        break
      case 'vendor':
        policy.vendor_patch = value
        break
      case 'all': {
        policy.os_patch = stripDay(value)
        policy.boot_patch = value
        policy.vendor_patch = value
        break
      }
    }
  }
  return Object.keys(policy).length > 0 ? policy : null
}

function serializeTarget(target: string[]): string {
  return target.join('\n')
}

function isNoOpPolicy(policy: Policy | undefined | null): boolean {
  if (!policy) return true
  return [policy.os_patch, policy.vendor_patch, policy.boot_patch]
    .every(v => v === undefined || v === 'no')
}

function serializeSecurityPatch(policy: Policy): string {
  const lines: string[] = []
  if (policy.os_patch !== undefined) lines.push(`system=${policy.os_patch}`)
  if (policy.boot_patch !== undefined) lines.push(`boot=${policy.boot_patch}`)
  if (policy.vendor_patch !== undefined) lines.push(`vendor=${policy.vendor_patch}`)
  return lines.join('\n')
}

export class ConfigLegacy extends Config {
  override readonly identity: string = 'TS-L'

  protected override readonly CONFIG_FILE = this.CONFIG_PATH + '/target.txt'
  protected readonly SECURITY_PATCH_FILE = this.CONFIG_PATH + '/security_patch.txt'

  protected readonly perAppConfig: boolean = false

  override async read(): Promise<void> {
    if (import.meta.env.DEV) {
      this.set({
        default_policy: { os_patch: 'no', vendor_patch: 'no', boot_patch: 'no' },
        target: [
          'io.github.vvb2060.keyattestation',
          'io.github.vvb2060.mahoshojo?',
          'com.google.android.gms!',
        ],
      })
      return
    }

    const data: ConfigData = {}

    try {
      const targetRaw = await File.read(this.CONFIG_FILE)
      data.target = parseTarget(targetRaw)
    } catch {
      data.target = []
    }

    try {
      const spRaw = await File.read(this.SECURITY_PATCH_FILE)
      const policy = parseSecurityPatch(spRaw)
      if (policy) data.default_policy = policy
    } catch {
      // security_patch.txt missing — leave default_policy unset
    }

    if (!data.default_policy) {
      data.default_policy = { os_patch: 'no', vendor_patch: 'no', boot_patch: 'no' }
    }

    this.set(data)
  }

  override async write(): Promise<void> {
    const data = this.get()

    const writeTasks: Promise<void>[] = []

    if (data.target) {
      writeTasks.push(File.write(this.CONFIG_FILE, serializeTarget(data.target)))
    }

    if (data.default_policy && !isNoOpPolicy(data.default_policy)) {
      writeTasks.push(File.write(this.SECURITY_PATCH_FILE, serializeSecurityPatch(data.default_policy)))
    } else {
      writeTasks.push(File.delete(this.SECURITY_PATCH_FILE))
    }

    // Per-app policy sections are intentionally skipped
    await Promise.all(writeTasks)
  }
}
