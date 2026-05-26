import { Cli } from './cli'
import { File } from './file'
import { GITHUB_REPO, MOD_ID } from './constant'

const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}`
const UPDATE_JSON_URL = `${RAW_URL}/main/update.json`
const NIGHTLY_LINK = `https://nightly.link/${GITHUB_REPO}/workflows/build/main?preview`
const BOT_BASE = `${RAW_URL}/bot`
const MIRROR_BASE = 'https://gh.sevencdn.com/'
const UPDATE_PROP = `/common/update/module.prop`

export interface UpdateInfo {
  available: boolean
  version: string | null
  versionCode: number | null
}

export class UpdateManager {
  #cli: Cli

  constructor(cli: Cli) {
    this.#cli = cli
  }

  async #getLocalVersionCode(): Promise<number> {
    try {
      const basePath = await this.#cli.getBasePath()
      const value = await this.#cli.grepProp('versionCode', basePath + UPDATE_PROP)
      return value ? parseInt(value, 10) : 0
    } catch {
      return 0
    }
  }

  async showModule(show: boolean): Promise<void> {
    try {
      const basePath = await this.#cli.getBasePath()
      if (show) {
        await File.copy(basePath + UPDATE_PROP, `${basePath}/module.prop`)
      } else {
        await File.delete(`${basePath}/module.prop`)
      }
    } catch {}
  }

  async checkUpdate(channel: 'stable' | 'canary'): Promise<UpdateInfo> {
    if (channel === 'stable') return this.#checkStableUpdate()
    return this.#checkCanaryUpdate()
  }

  async update(channel: 'stable' | 'canary'): Promise<boolean> {
    if (channel === 'stable') return this.#performStableUpdate()
    return this.#performCanaryUpdate()
  }

  async getChangelog(channel: 'stable' | 'canary', versionCode?: number | null): Promise<string> {
    if (channel === 'canary') return `A new version is available: ${versionCode ?? 'unknown'}`
    return this.#getStableChangelog()
  }

  async updateLocales(): Promise<boolean> {
    try {
      const response = await this.#fetchWithFallback(`${BOT_BASE}/locales_version`)
      if (!response.ok) return false
      const remoteVersion = (await response.text()).trim()

      const localResp = await fetch('./locales/version').catch(() => null)
      const localVersion = localResp ? (await localResp.text()).trim() : '0'

      if (Number(remoteVersion) <= Number(localVersion)) return true

      const basePath = await this.#cli.getBasePath()
      const tmpDir = `${basePath}/common/tmp`
      const localesDir = `${basePath}/webui/locales`
      const localseUpdateDir = `/data/adb/modules_update/${MOD_ID}/webui/locales`
      const zipPath = `${tmpDir}/locales.zip`

      await File.createDirectory(tmpDir)
      await this.#downloadFile(`${BOT_BASE}/locales.zip`, zipPath)
      await this.#cli.unzip(zipPath, localesDir)
      if (await File.isDirectory(localseUpdateDir)) {
        await this.#cli.unzip(zipPath, localseUpdateDir)
      }
      await File.write(`${localesDir}/version`, remoteVersion)
      await File.delete(zipPath)
      return true
    } catch {
      return false
    }
  }

  async #checkStableUpdate(): Promise<UpdateInfo> {
    try {
      const response = await fetch(UPDATE_JSON_URL)
      if (!response.ok) return { available: false, version: null, versionCode: null }

      const data = (await response.json()) as { versionCode: number; version: string }
      const localVersionCode = await this.#getLocalVersionCode()

      this.showModule(data.versionCode > localVersionCode)

      return {
        available: data.versionCode > localVersionCode,
        version: data.version,
        versionCode: data.versionCode,
      }
    } catch {
      return { available: false, version: null, versionCode: null }
    }
  }

  async #performStableUpdate(): Promise<boolean> {
    const response = await fetch(UPDATE_JSON_URL)
    if (!response.ok) throw new Error('Failed to fetch stable update info')
    const data = (await response.json()) as { zipUrl: string }
    return this.#downloadAndInstall(data.zipUrl)
  }

  async #getStableChangelog(): Promise<string> {
    try {
      const response = await fetch(UPDATE_JSON_URL)
      if (!response.ok) return 'Failed to fetch changelog'
      const data = (await response.json()) as { version?: string; changelog?: string }
      if (!data.changelog || !data.version) return 'No changelog available'

      const changelogResp = await fetch(data.changelog)
      if (!changelogResp.ok) return 'Failed to fetch changelog'
      const fullChangelog = await changelogResp.text()

      const header = `### ${data.version}`
      const lines = fullChangelog.split('\n')
      let found = false
      const result: string[] = []

      for (const line of lines) {
        if (line === header) {
          found = true
          result.push(line)
          continue
        }
        if (found) {
          if (line.startsWith('### ')) break
          result.push(line)
        }
      }

      return found ? result.join('\n').trim() : fullChangelog
    } catch {
      return 'Failed to fetch changelog'
    }
  }

  async #getCanaryZipUrl(): Promise<string | null> {
    try {
      const basePath = await this.#cli.getBasePath()
      const tmpDir = `${basePath}/common/tmp`
      const nightlyPage = `${tmpDir}/nightly.html`

      await File.createDirectory(tmpDir)
      await this.#cli.downloadFile(NIGHTLY_LINK, nightlyPage)
      const html = await File.read(nightlyPage)
      await File.delete(nightlyPage)

      const match = html.match(/href="([^"]+\.zip)"/)
      if (!match) return null

      const href = match[1]
      return href.startsWith('http') ? href : `https://nightly.link${href}`
    } catch {
      return null
    }
  }

  async #checkCanaryUpdate(): Promise<UpdateInfo> {
    try {
      const localVersionCode = await this.#getLocalVersionCode()
      const zipUrl = await this.#getCanaryZipUrl()
      if (!zipUrl) return { available: false, version: null, versionCode: null }

      const parts = zipUrl.split('-')
      const remoteVersionCode = parts.length >= 2 ? parseInt(parts[parts.length - 2], 10) : NaN
      if (isNaN(remoteVersionCode)) return { available: false, version: null, versionCode: null }

      return {
        available: remoteVersionCode > localVersionCode,
        version: String(remoteVersionCode),
        versionCode: remoteVersionCode,
      }
    } catch {
      return { available: false, version: null, versionCode: null }
    }
  }

  async #performCanaryUpdate(): Promise<boolean> {
    const zipUrl = await this.#getCanaryZipUrl()
    if (!zipUrl) throw new Error('Failed to fetch nightly link')

    return this.#downloadAndInstall(zipUrl)
  }

  async #fetchWithFallback(url: string): Promise<Response> {
    const response = await fetch(url)
    if (response.ok) return response

    const mirrorUrl = `${MIRROR_BASE}${url}`
    const mirrorResponse = await fetch(mirrorUrl)
    if (!mirrorResponse.ok) {
      throw new Error(`Fetch failed: ${response.status} (direct), ${mirrorResponse.status} (mirror)`)
    }
    return mirrorResponse
  }

  async #downloadFile(url: string, destPath: string): Promise<void> {
    try {
      await this.#cli.downloadFile(url, destPath)
    } catch {
      await this.#cli.downloadFile(`${MIRROR_BASE}${url}`, destPath)
    }
  }

  async #downloadAndInstall(url: string): Promise<boolean> {
    const basePath = await this.#cli.getBasePath()
    const tmpDir = `${basePath}/common/tmp`

    await File.createDirectory(tmpDir)
    await this.#downloadFile(url, `${tmpDir}/module.zip`)
    try {
      await this.#cli.installModule(`${tmpDir}/module.zip`)
    } catch {
      return false
    }
    await this.updateLocales()
    return true
  }
}
