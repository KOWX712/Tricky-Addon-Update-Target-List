import { listPackages, getPackagesInfo } from 'kernelsu-alt'
import type { PackagesInfo } from 'kernelsu-alt'
import type { MdDialog, MdRadio } from '@material/web/all'
import { Cli } from '../cli'
import { Config } from '../config'
import { i18n } from '../i18n'
import { File } from '../file'
import { GITHUB_REPO, LOCAL_STORAGE_PREFIX, TS_PATH } from '../constant'
import { applyDialogAnimation } from '../dialog/animation'
import { PolicyEditor } from './policy'
import './app_list.scss'

const SYSTEM_APPS_KEY = `${LOCAL_STORAGE_PREFIX}AdditionalApps`
const DEFAULT_ADDITIONAL_APPS = [
  'com.google.android.gms', // Play Service
  'com.android.vending',    // Play Store
  'com.oplus.deepthinker',
  'com.heytap.speechassist',
  'com.coloros.sceneservice',
]

export interface AppEntry {
  packageName: string
  appName: string
  isSystem: boolean
}

function stripSuffix(pkg: string): string {
  return pkg.endsWith('!') || pkg.endsWith('?') ? pkg.slice(0, -1) : pkg
}

export class AppList {
  #entries: AppEntry[] = []
  #config: Config
  #cli: Cli
  #iconObserver: IntersectionObserver | null = null
  #systemAppIconObserver: IntersectionObserver | null = null
  #currentModeCard: HTMLElement | null = null
  #container: HTMLElement | null = null
  #policyEditor!: PolicyEditor
  menuOpen = false

  constructor(config: Config, cli: Cli) {
    this.#config = config
    this.#cli = cli
  }

  async fetch(): Promise<void> {
    if (import.meta.env.DEV) {
      this.#initDevMode()
      return
    }

    const pkgs = await listPackages('all').catch(() => [])

    let infos: PackagesInfo[]
    try {
      infos = await getPackagesInfo(pkgs) as PackagesInfo[]
    } catch {
      infos = pkgs.map((pkg: string) => ({
        packageName: pkg,
        versionName: '',
        versionCode: 0,
        appLabel: pkg,
        isSystem: false,
        uid: 0,
      }))
    }

    this.#entries = pkgs.map((pkg: string, i: number) => ({
      packageName: pkg,
      appName: infos[i]?.appLabel || pkg,
      isSystem: infos[i]?.isSystem ?? false,
    }))
  }

  getEntries(): AppEntry[] {
    return this.#entries
  }

  async save(): Promise<void> {
    if (import.meta.env.DEV) return
    await this.#config.write()
  }

  async refresh(force: boolean = true): Promise<void> {
    if (force) {
      await this.#config.read()
      await this.fetch()
      if (this.#container) {
        this.renderAppList(this.#container)
        window.scrollTo(0, 0)
      }
    } else {
      if (this.#container) {
        this.renderAppList(this.#container)
      }
      this.#syncCheckboxes()
    }
  }

  syncSystemAppsWithConfig(): void {
    const target = (this.#config.get('target') as string[]) || []
    const additionalApps = this.getAdditionalApps()
    let changed = false

    for (const raw of target) {
      const pkg = stripSuffix(raw)
      const entry = this.#entries.find(e => e.packageName === pkg)
      if (entry?.isSystem && !additionalApps.includes(pkg)) {
        additionalApps.push(pkg)
        changed = true
      }
    }

    if (changed) {
      this.saveAdditionalApps(additionalApps)
    }
  }

  #syncCheckboxes(): void {
    if (!this.#container) return
    const target = (this.#config.get('target') as string[]) || []
    this.#container.querySelectorAll<HTMLElement>('.card').forEach(card => {
      const pkg = card.dataset.package!
      const checkbox = card.querySelector('md-checkbox')!
      const raw = target.find(t => stripSuffix(t) === pkg)
      const targeted = raw !== undefined

      checkbox.checked = targeted
      card.classList.toggle('selected', targeted)
      checkbox.classList.remove('checkbox-checked-generated', 'checkbox-checked-hack')
      if (targeted && raw!.endsWith('!')) checkbox.classList.add('checkbox-checked-generated')
      else if (targeted && raw!.endsWith('?')) checkbox.classList.add('checkbox-checked-hack')
    })
  }

  selectAll(): void {
    if (!this.#container) return
    const target = (this.#config.get('target') as string[]) || []
    this.#container.querySelectorAll<HTMLElement>('.card').forEach(card => {
      const pkg = card.dataset.package!
      if (!target.some(t => stripSuffix(t) === pkg)) {
        this.#config.push('target', pkg)
      }
      card.querySelector('md-checkbox')!.checked = true
      card.classList.add('selected')
    })
  }

  deselectAll(): void {
    if (!this.#container) return
    this.#config.set('target', [])
    this.#container.querySelectorAll<HTMLElement>('.card').forEach(card => {
      const checkbox = card.querySelector('md-checkbox')!
      checkbox.checked = false
      card.classList.remove('selected', 'checkbox-checked-generated', 'checkbox-checked-hack')
    })
  }

  async fetchDenyList(): Promise<void> {
    const denylist = await this.#cli.getMagiskDenyList()
    if (denylist.length < 1) return
    const target = (this.#config.get('target') as string[]) || []
    for (const pkg of denylist) {
      if (!target.includes(pkg)) this.#config.push('target', pkg)
    }
    this.#syncCheckboxes()
    await File.createFile(TS_PATH + '/target_from_denylist')
  }

  async deselectUnnecessary(): Promise<void> {
    try {
      const link = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/more-exclude.json`
      let response = await fetch(link)
      if (!response.ok) {
        response = await fetch(`https://gh.sevencdn.com/${link}`)
      }
      if (!response.ok) throw new Error('Failed to download unnecessary apps')

      const data: { data: Array<{ apps: Array<{ 'package-name': string }> }> } = await response.json()
      const excludeList: string[] = data.data
        .flatMap(category => category.apps)
        .map(app => app['package-name'])

      const xposedList = await this.#cli.getXposedList()
      const unnecessaryApps = new Set([...excludeList, ...xposedList])

      const target = (this.#config.get('target') as string[]) || []
      const filtered = target.filter(t => {
        const pkg = t.endsWith('!') || t.endsWith('?') ? t.slice(0, -1) : t
        return !unnecessaryApps.has(pkg)
      })
      this.#config.set({ ...this.#config.get(), target: filtered })
      this.#syncCheckboxes()
    } catch (error) {
      console.error('Failed to deselect unnecessary apps:', error)
    }
  }

  renderAppList(container: HTMLElement): void {
    this.#container = container
    container.innerHTML = ''

    const additionalApps = this.getAdditionalApps()
    const displayed = this.#entries.filter(
      e => !e.isSystem || additionalApps.includes(e.packageName),
    )

    const target = (this.#config.get('target') as string[]) || []

    displayed.sort((a, b) => {
      const aTargeted = target.some(t => stripSuffix(t) === a.packageName)
      const bTargeted = target.some(t => stripSuffix(t) === b.packageName)
      if (aTargeted !== bTargeted) return aTargeted ? -1 : 1
      return (a.appName || '').localeCompare(b.appName || '')
    })

    const fragment = document.createDocumentFragment()
    for (const entry of displayed) {
      const raw = target.find(t => stripSuffix(t) === entry.packageName)
      const targeted = raw !== undefined
      const mode = targeted && raw!.endsWith('!') ? 'generate' : targeted && raw!.endsWith('?') ? 'hack' : 'auto'
      fragment.appendChild(this.#createCard(entry, targeted, mode))
    }
    container.appendChild(fragment)

    if (!document.getElementById('mode-dialog')) {
      document.body.insertAdjacentHTML('beforeend', AppList.#modeDialogHtml())
      this.#setupModeDialogListeners()
    }

    this.#iconObserver?.disconnect()
    this.#iconObserver = this.#setupIconObserver(container)
    this.#setupCardListeners(container)
  }

  renderSystemAppList(container: HTMLElement): void {
    container.innerHTML = ''

    const additionalApps = this.getAdditionalApps()
    const systemEntries = this.#entries.filter(e => e.isSystem)

    systemEntries.sort((a, b) => {
      const aChecked = additionalApps.includes(a.packageName)
      const bChecked = additionalApps.includes(b.packageName)
      if (aChecked !== bChecked) return aChecked ? -1 : 1
      return (a.appName || '').localeCompare(b.appName || '')
    })

    const fragment = document.createDocumentFragment()
    for (const entry of systemEntries) {
      const cardBox = this.#createCard(entry, false, 'auto')
      const checkbox = cardBox.querySelector('md-checkbox')!
      if (additionalApps.includes(entry.packageName)) {
        checkbox.checked = true
        cardBox.querySelector('.card')!.classList.add('selected')
      }
      fragment.appendChild(cardBox)
    }
    container.appendChild(fragment)

    this.#systemAppIconObserver?.disconnect()
    this.#systemAppIconObserver = this.#setupIconObserver(container)
    this.#setupSystemAppListeners(container)
  }

  getAdditionalApps(): string[] {
    try {
      const raw = localStorage.getItem(SYSTEM_APPS_KEY)
      return raw ? JSON.parse(raw) as string[] : [...DEFAULT_ADDITIONAL_APPS]
    } catch {
      return [...DEFAULT_ADDITIONAL_APPS]
    }
  }

  saveAdditionalApps(apps: string[]): void {
    localStorage.setItem(SYSTEM_APPS_KEY, JSON.stringify(apps))
  }

  #createCard(entry: AppEntry, targeted: boolean, mode: string): HTMLElement {
    const selectedClass = targeted ? ' selected' : ''
    let modeClass = ''
    if (targeted) {
      if (mode === 'generate') modeClass = ' checkbox-checked-generated'
      else if (mode === 'hack') modeClass = ' checkbox-checked-hack'
    }
    const checkedAttr = targeted ? 'checked' : ''

    const wrapper = document.createElement('div')
    wrapper.innerHTML = /* html */ `
      <div class="card-box">
        <div class="card card-alpha content${selectedClass}" data-package="${entry.packageName}">
          <md-ripple></md-ripple>
          <label class="name" for="checkbox-${entry.packageName}">
            <div class="app-icon-container">
              <div class="loader" data-package="${entry.packageName}"></div>
              <img class="app-icon" data-package="${entry.packageName}" alt="${entry.appName}" draggable="false" />
              <div class="app-icon-fallback" data-package="${entry.packageName}">
                <svg viewBox="0 -960 960 960" xmlns="http://www.w3.org/2000/svg"><path d="M40-240q9-107 65.5-197T256-580l-74-128q-6-9-3-19t13-15q8-5 18-2t16 12l74 128q86-36 180-36t180 36l74-128q6-9 16-12t18 2q10 5 13 15t-3 19l-74 128q94 53 150.5 143T920-240H40Zm275.5-124.5Q330-379 330-400t-14.5-35.5Q301-450 280-450t-35.5 14.5Q230-421 230-400t14.5 35.5Q259-350 280-350t35.5-14.5Zm400 0Q730-379 730-400t-14.5-35.5Q701-450 680-450t-35.5 14.5Q630-421 630-400t14.5 35.5Q659-350 680-350t35.5-14.5Z"/></svg>
              </div>
            </div>
            <div class="app-info">
              <div class="app-name">${entry.appName}</div>
              <div class="package-name">${entry.packageName}</div>
            </div>
          </label>
          <md-checkbox class="checkbox${modeClass}" id="checkbox-${entry.packageName}" touch-target="wrapper" ${checkedAttr}></md-checkbox>
        </div>
      </div>`
    return wrapper.firstElementChild as HTMLElement
  }

  #setupCardListeners(container: HTMLElement): void {
    const cards = container.querySelectorAll<HTMLElement>('.card')
    cards.forEach(card => {
      card.onclick = () => {
        if (this.menuOpen) return
        const pkg = card.dataset.package!
        const checkbox = card.querySelector('md-checkbox')!
        const target = (this.#config.get('target') as string[]) || []

        if (checkbox.checked) {
          const idx = target.findIndex(t => stripSuffix(t) === pkg)
          if (idx >= 0) this.#config.removeMatch('target', t => stripSuffix(t) === pkg)
          checkbox.checked = false
          card.classList.remove('selected')
          checkbox.classList.remove('checkbox-checked-generated', 'checkbox-checked-hack')
        } else {
          this.#config.push('target', pkg)
          checkbox.checked = true
          card.classList.add('selected')
        }
      }

      card.addEventListener('contextmenu', (e) => {
        const checkbox = card.querySelector('md-checkbox')!
        if (checkbox.checked) {
          e.preventDefault()
          this.#openModeDialog(card)
        }
      })
    })
  }

  #setupSystemAppListeners(container: HTMLElement): void {
    const cards = container.querySelectorAll<HTMLElement>('.card')
    cards.forEach(card => {
      card.onclick = () => {
        const checkbox = card.querySelector('md-checkbox')!
        checkbox.checked = !checkbox.checked
        card.classList.toggle('selected')
      }
    })
  }

  async saveSystemAppSelection(checkedApps: string[]): Promise<void> {
    this.saveAdditionalApps(checkedApps)

    const target = (this.#config.get('target') as string[]) || []
    const systemEntries = this.#entries.filter(e => e.isSystem)

    for (const entry of systemEntries) {
      const pkg = entry.packageName
      const targetIdx = target.findIndex(t => stripSuffix(t) === pkg)
      const isChecked = checkedApps.includes(pkg)

      if (isChecked && targetIdx === -1) {
        this.#config.push('target', pkg)
      } else if (!isChecked && targetIdx !== -1) {
        this.#config.removeMatch('target', t => stripSuffix(t) === pkg)
      }
    }
    await this.refresh(false)
  }

  #setupIconObserver(container: HTMLElement): IntersectionObserver {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const pkg = el.querySelector('.app-icon')?.getAttribute('data-package')
          if (pkg) {
            this.#loadIcon(pkg, el)
            observer.unobserve(el)
          }
        }
      })
    }, { rootMargin: '100px', threshold: 0.1 })

    container.querySelectorAll('.app-icon-container').forEach(el => {
      observer.observe(el)
    })

    return observer
  }

  #loadIcon(packageName: string, scopeEl?: HTMLElement): void {
    const root = scopeEl ?? document
    const img = root.querySelector<HTMLImageElement>(`.app-icon[data-package="${packageName}"]`)
    const loader = root.querySelector<HTMLElement>(`.loader[data-package="${packageName}"]`)
    if (!img) return
    img.onload = () => {
      if (loader) loader.style.display = 'none'
      img.style.opacity = '1'
    }
    img.onerror = () => {
      img.style.display = 'none'
      const fallback = root.querySelector<HTMLElement>(`.app-icon-fallback[data-package="${packageName}"]`)
      if (fallback) fallback.classList.add('visible')
      if (loader) loader.style.display = 'none'
    }
    img.src = `ksu://icon/${packageName}`
  }

  static #modeDialogHtml(): string {
    return /* html */ `
    <md-dialog id="mode-dialog">
      <div slot="headline">
        <div>${i18n.t('mode_dialog_title')}</div>
        <div id="mode-dialog-appname"></div>
      </div>
      <div slot="content" class="mode-dialog-content">
        <div class="mode-options">
          <label class="mode-option">
            <md-radio id="mode-default" name="mode" value="auto"></md-radio>
            <span>${i18n.t('mode_auto')}</span>
          </label>
          <label class="mode-option">
            <md-radio id="mode-generate" name="mode" value="generate" class="mode-generated"></md-radio>
            <span>${i18n.t('mode_certificate_generating')}</span>
            <span class="mode-icon mode-generated">!</span>
          </label>
          <label class="mode-option">
            <md-radio id="mode-hack" name="mode" value="hack" class="mode-hack"></md-radio>
            <span>${i18n.t('mode_leaf_hack')}</span>
            <span class="mode-icon mode-hack">?</span>
          </label>
        </div>
        <div id="mode-policy-section" class="mode-policy-section hidden">
          <md-divider></md-divider>
          <md-filled-tonal-button id="mode-policy-toggle">${i18n.t('mode_set_custom_policy')}</md-filled-tonal-button>
          <div id="mode-policy-fields" class="mode-policy-fields hidden">
            ${PolicyEditor.html()}
          </div>
        </div>
      </div>
      <div slot="actions">
        <md-outlined-button id="mode-cancel">${i18n.t('functional_button_cancel')}</md-outlined-button>
        <md-filled-button id="mode-save">${i18n.t('functional_button_save')}</md-filled-button>
      </div>
    </md-dialog>`
  }

  #setupModeDialogListeners(): void {
    const dialog = document.getElementById('mode-dialog')! as MdDialog
    applyDialogAnimation(dialog)

    if (this.#config.supportsPerAppConfig) {
      this.#policyEditor = new PolicyEditor(document.getElementById('mode-policy-fields')!)
      this.#policyEditor.bind()

      document.getElementById('mode-policy-toggle')!.onclick = () => {
        const fields = document.getElementById('mode-policy-fields')!
        const toggle = document.getElementById('mode-policy-toggle')!
        const isHidden = fields.classList.contains('hidden')
        fields.classList.toggle('hidden', !isHidden)
        toggle.textContent = isHidden ? i18n.t('mode_use_default_policy') : i18n.t('mode_set_custom_policy')
      }
    } else {
      document.getElementById('mode-policy-section')?.classList.add('hidden')
    }

    document.getElementById('mode-cancel')!.onclick = () => {
      this.#currentModeCard = null
      dialog.close?.()
    }

    document.getElementById('mode-save')!.onclick = () => {
      if (!this.#currentModeCard) return
      const pkg = this.#currentModeCard.dataset.package!
      const checkbox = this.#currentModeCard.querySelector('md-checkbox')!

      const radios = dialog.querySelectorAll<MdRadio>('md-radio')
      const selectedRadio = Array.from(radios).find(r => r.checked)
      const modeValue = selectedRadio?.value ?? 'auto'
      const target = (this.#config.get('target') as string[]) || []
      const idx = target.findIndex(t => stripSuffix(t) === pkg)

      checkbox.classList.remove('checkbox-checked-generated', 'checkbox-checked-hack')

      if (idx >= 0) {
        const newValue = modeValue === 'generate' ? `${pkg}!` : modeValue === 'hack' ? `${pkg}?` : pkg
        this.#config.replaceMatch('target', t => stripSuffix(t) === pkg, newValue)

        if (modeValue === 'generate') checkbox.classList.add('checkbox-checked-generated')
        else if (modeValue === 'hack') checkbox.classList.add('checkbox-checked-hack')
      }

      if (this.#config.supportsPerAppConfig) {
        const policy = this.#policyEditor.getPolicy()
        this.#config.set(pkg, policy ?? undefined)
      }

      this.#currentModeCard = null
      dialog.close?.()
    }
  }

  #openModeDialog(card: HTMLElement): void {
    const dialog = document.getElementById('mode-dialog') as MdDialog & { show?: () => void }
    if (!dialog) return

    const pkg = card.dataset.package!
    this.#currentModeCard = card

    const appNameDisplay = document.getElementById('mode-dialog-appname')!
    const appName = card.querySelector('.app-name')?.textContent ?? pkg
    appNameDisplay.innerHTML = `${appName}<br>${pkg}`

    const target = (this.#config.get('target') as string[]) || []
    const raw = target.find(t => stripSuffix(t) === pkg)
    const mode = raw?.endsWith('!') ? 'generate' : raw?.endsWith('?') ? 'hack' : 'auto'

    const radios = dialog.querySelectorAll<MdRadio & { checked?: boolean }>('md-radio')
    radios.forEach(r => {
      r.checked = r.value === mode
    })

    if (this.#config.supportsPerAppConfig) {
      const configData = this.#config.get()
      const section = configData[pkg]
      const hasPolicy = typeof section === 'object' && !Array.isArray(section)

      document.getElementById('mode-policy-section')!.classList.remove('hidden')
      const fields = document.getElementById('mode-policy-fields')!
      const toggle = document.getElementById('mode-policy-toggle')!
      if (hasPolicy) {
        fields.classList.remove('hidden')
        toggle.textContent = i18n.t('mode_use_default_policy')
      } else {
        fields.classList.add('hidden')
        toggle.textContent = i18n.t('mode_set_custom_policy')
      }
      this.#policyEditor.setPolicy(hasPolicy ? section : null)
    }

    dialog.show()
  }

  // Debug
  #initDevMode(): void {
    const configData = this.#config.get()
    if (!configData.target || configData.target.length === 0) {
      configData.target = [
        'io.github.vvb2060.keyattestation',
        'io.github.vvb2060.mahoshojo?',
        'com.google.android.gms!',
        'com.example.banking',
        'com.example.wallet!',
      ]
    }
    configData['com.google.android.gms'] = {
      os_patch: 'prop', vendor_patch: 'YYYYMM05', boot_patch: '20260505',
    }
    configData['com.example.banking'] = {
      os_patch: 'prop', vendor_patch: '20260601', boot_patch: 'prop',
    }

    this.#entries = [
      { packageName: 'io.github.vvb2060.keyattestation', appName: 'Key Attestation', isSystem: false },
      { packageName: 'io.github.vvb2060.mahoshojo', appName: 'Mahoshojo', isSystem: false },
      { packageName: 'com.example.app', appName: 'Example App', isSystem: false },
      { packageName: 'com.example.banking', appName: 'My Banking App', isSystem: false },
      { packageName: 'com.example.social', appName: 'Social Media', isSystem: false },
      { packageName: 'com.example.game', appName: 'Awesome Game', isSystem: false },
      { packageName: 'com.example.wallet', appName: 'Digital Wallet', isSystem: false },
      { packageName: 'com.example.streaming', appName: 'Video Streaming', isSystem: false },
      { packageName: 'com.google.android.gms', appName: 'Google Play Services', isSystem: true },
      { packageName: 'com.android.vending', appName: 'Google Play Store', isSystem: true },
      { packageName: 'com.oplus.deepthinker', appName: 'Deep Thinker', isSystem: true },
      { packageName: 'com.heytap.speechassist', appName: 'HeyTap Speech Assist', isSystem: true },
      { packageName: 'com.coloros.sceneservice', appName: 'ColorOS Scene Service', isSystem: true },
      { packageName: 'com.google.android.gsf', appName: 'Google Services Framework', isSystem: true },
      { packageName: 'com.qualcomm.qti', appName: 'Qualcomm Technologies', isSystem: true },
    ]
  }
}
