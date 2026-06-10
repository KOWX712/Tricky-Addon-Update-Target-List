import { exec, spawn } from 'kernelsu-alt'
import { File } from './file'
import { MOD_ID, OMK_MOD_ID, TS_MOD_ID, OMK_STATE_DIR } from './constant'

export type ActiveEngine = 'tricky_store' | 'oh_my_keymint' | 'unknown'

export class Cli {
  static #basePathPromise: Promise<string> | null = null
  static #activeEnginePromise: Promise<ActiveEngine> | null = null

  constructor() {
    if (!Cli.#basePathPromise) {
      Cli.#basePathPromise = this.#resolveBasePath()
    }
    if (!Cli.#activeEnginePromise) {
      Cli.#activeEnginePromise = this.#resolveActiveEngine()
    }
  }

  async getBasePath(): Promise<string> {
    return Cli.#basePathPromise!
  }

  // ------------------------------------------------------------------
  // Determine which engine is active: OMK or TrickyStore
  // OMK takes priority when both are installed (it is the newer engine)
  // ------------------------------------------------------------------
  async getActiveEngine(): Promise<ActiveEngine> {
    return Cli.#activeEnginePromise!
  }

  async #resolveBasePath(): Promise<string> {
    const exists = await File.exist(`/data/adb/modules/.${MOD_ID}`)
    return exists ? `/data/adb/modules/.${MOD_ID}` : `/data/adb/modules/${MOD_ID}`
  }

  async #resolveActiveEngine(): Promise<ActiveEngine> {
    // Check OMK first — it takes priority
    try {
      const raw = await File.read(`/data/adb/modules/${OMK_MOD_ID}/module.prop`)
      if (raw) {
        const disabled = await File.exist(`/data/adb/modules/${OMK_MOD_ID}/disable`)
        if (!disabled) return 'oh_my_keymint'
      }
    } catch {}

    // Then TrickyStore
    try {
      const raw = await File.read(`/data/adb/modules/${TS_MOD_ID}/module.prop`)
      if (raw) {
        const disabled = await File.exist(`/data/adb/modules/${TS_MOD_ID}/disable`)
        if (!disabled) return 'tricky_store'
      }
    } catch {}

    return 'unknown'
  }

  async exec(cmd: string, opts?: { env?: Record<string, string> }): Promise<{ errno: number; stdout: string; stderr: string }> {
    return exec(cmd, opts)
  }

  async grepProp(key: string, filePath: string): Promise<string | null> {
    const result = await exec(`grep '^${key}=' '${filePath}' | cut -d'=' -f2`)
    return result.errno === 0 ? result.stdout.trim() : null
  }

  async getTrickyStoreInfo(): Promise<Record<string, string>> {
    // Try OMK first, then TrickyStore
    const ids = [OMK_MOD_ID, TS_MOD_ID]
    let raw = ''
    for (const id of ids) {
      try {
        raw = await File.read('/data/adb/modules/' + id + '/module.prop')
        const disabled = await File.exist('/data/adb/modules/' + id + '/disable')
        if (!disabled) break
      } catch {}
    }
    if (!raw) throw new Error('getTrickyStoreInfo failed: module.prop not found')
    const info: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx <= 0) continue
      info[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
    }
    return info
  }

  async linkRedirect(url: string): Promise<void> {
    const result = await exec(`am start -a android.intent.action.VIEW -d '${url}'`)
    if (result.errno !== 0) window.open(url, '_blank')
  }

  async getAospKey(): Promise<string> {
    const basePath = await Cli.#basePathPromise
    const { stdout, errno } = await exec(`xxd -r -p ${basePath}/common/.default | base64 -d`)
    if (errno !== 0 || !stdout.trim()) throw new Error('getAospKey failed')
    return stdout
  }

  async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tryCurl = () => {
        const curl = spawn('curl', ['--connect-timeout', '10', '-L', '-s', '-o', destPath, url],
          { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin" }})
        curl.on('exit', (code) => {
          if (code === 0) resolve()
          else tryWget()
        })
        curl.on('error', () => tryWget())
      }
      const tryWget = () => {
        const wget = spawn('busybox', ['wget', '-T', '10', '--no-check-certificate', '-qO', destPath, url],
          { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk:/data/data/com.termux/files/usr/bin" }})
        wget.on('exit', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`downloadFile failed: wget exit(${code})`))
        })
        wget.on('error', (err) => reject(new Error(`downloadFile failed: wget error(${err.message})`)))
      }
      tryCurl()
    })
  }

  async unzip(zipPath: string, dest: string): Promise<void> {
    await File.createDirectory(dest)
    const result = await exec(`unzip -o '${zipPath}' -d '${dest}'`)
    if (result.errno !== 0) {
      throw new Error(`unzip failed (${result.errno}): ${result.stderr}`)
    }
  }

  async getManager(): Promise<string> {
    const basePath = await this.getBasePath()
    return (await this.grepProp('MANAGER', `${basePath}/common/manager.sh`)) || ''
  }

  async installModule(zipPath: string): Promise<boolean> {
    return this.#manageModule('install', zipPath)
  }

  async uninstallModule(modId: string): Promise<boolean> {
    return this.#manageModule('uninstall', modId)
  }

  async #manageModule(option: 'install' | 'uninstall', module: string): Promise<boolean> {
    const basePath = await this.getBasePath()
    const manager = await this.getManager()

    return new Promise((resolve, reject) => {
      let cmd: [string, string[]]

      const cleanup = () => File.delete(`${basePath}/common/tmp`).catch(() => {})

      switch (manager) {
        case 'APATCH':
          if (option == 'uninstall') File.copy(`${basePath}/update/module.prop`, `${basePath}/module.prop`)
          cmd = ['apd', ['module', option, module]]
          break
        case 'KSU':
          if (option == 'uninstall') File.copy(`${basePath}/update/module.prop`, `${basePath}/module.prop`)
          cmd = ['ksud', ['module', option, module]]
          break
        case 'MAGISK':
          if (option == 'uninstall') File.copy(`${basePath}/update`, `/data/adb/modules/${MOD_ID}`)
          cmd = ['magisk', [`--${option}-module`, module]]
          break
        default:
          if (option == 'uninstall') {
            cmd = ['false', []]
            break
          }
          cleanup().then(() => reject(new Error(`Failed to ${option} module: unknown manager '${manager}'`)))
          return
      }

      let stdout = ''
      const proc = spawn(cmd[0], cmd[1], { env: { PATH: "$PATH:/data/adb/ap/bin:/data/adb/ksu/bin:/data/adb/magisk" } })
      proc.stdout.on('data', (chunk: string) => stdout += chunk)
      proc.on('exit', (code: number | null) => {
        if (code === 0) {
          cleanup().then(() => {
            if (stdout.includes('No need to reboot')) location.reload()
            resolve(true)
          })
        } else {
          if (option == 'uninstall') {
            File.createFile(`/data/adb/modules/${MOD_ID}/remove`).catch(() => {})
            resolve(true)
          } else {
            cleanup().then(() => reject(new Error(`Failed to ${option} module: exit(${code})`)))
          }
        }
      })
      proc.on('error', (err: Error) => {
        cleanup().then(() => reject(new Error(`Failed to ${option} module: ${err.message}`)))
      })
    })
  }

  async setBootHash(hash: string): Promise<void> {
    const result = await exec(`resetprop -n ro.boot.vbmeta.digest "${hash}" && resetprop -c || true`,
      { env: { PATH: "$PATH:/data/adb/ksu/bin:/data/adb/ap/bin:/data/adb/magisk" } })
    if (result.errno !== 0) throw new Error(`setBootHash failed (${result.errno})`)
  }

  async getMagiskDenyList(): Promise<string[]> {
    if (import.meta.env.DEV) {
      return [
        'com.example.game',
        'com.example.streaming',
        'io.github.vvb2060.keyattestation',
      ]
    }
    const result = await exec(`magisk --denylist ls 2>/dev/null | awk -F'|' '{print $1}' | grep -v "isolated"`)
    if (result.errno !== 0) return []
    return result.stdout.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  }

  async reboot(): Promise<void> {
    const result = await exec("svc power reboot || reboot")
    if (result.errno !== 0) throw new Error(`reboot failed (${result.errno})`)
  }

  async getXposedList(): Promise<string[]> {
    if (import.meta.env.DEV) {
      return [
        'org.lsposed.manager',
        'com.example.xposedmod1',
        'com.example.xposedmod2',
      ]
    }
    const basePath = await this.getBasePath()
    return new Promise((resolve) => {
      let stdout = ''
      const proc = spawn('sh', [`${basePath}/common/get_extra.sh`, '--xposed'])
      proc.stdout.on('data', (chunk: string) => stdout += chunk + '\n')
      proc.on('exit', (code: number | null) => {
        if (code === 0) {
          resolve(stdout.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0))
        } else {
          resolve([])
        }
      })
      proc.on('error', () => resolve([]))
    })
  }

  // ------------------------------------------------------------------
  // OMK-specific helpers
  // ------------------------------------------------------------------

  /**
   * Restart OMK daemons (keymint + injector) so that config changes take
   * effect without a full reboot.  Uses the restart marker files that the
   * daemon watchdogs already understand.
   */
  async restartOmkDaemons(): Promise<void> {
    // Create restart marker files — the daemon watchdogs pick these up
    await File.createFile(`${OMK_STATE_DIR}/restart.all`).catch(() => {})
    // Also set the system property as a fallback
    const env = { PATH: "$PATH:/data/adb/ksu/bin:/data/adb/ap/bin:/data/adb/magisk" }
    await exec(`resetprop persist.sys.omk.restart.all 1`, { env }).catch(() => {})
  }

  /**
   * Check whether the OMK keymint daemon is currently running.
   */
  async isOmkDaemonRunning(): Promise<boolean> {
    const result = await exec(`pidof keymint 2>/dev/null || echo ""`)
    return result.errno === 0 && result.stdout.trim().length > 0
  }

  /**
   * Check whether the OMK injector daemon is currently running.
   */
  async isOmkInjectorRunning(): Promise<boolean> {
    // The injector daemon itself doesn't have a unique name, but we can
    // check the state directory for the PID file.
    try {
      const pid = (await File.read(`${OMK_STATE_DIR}/injector-daemon.pid`)).trim()
      if (!pid) return false
      const result = await exec(`kill -0 ${pid} 2>/dev/null && echo "yes" || echo "no"`)
      return result.stdout.trim() === 'yes'
    } catch {
      return false
    }
  }
}
