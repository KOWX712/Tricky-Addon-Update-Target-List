import '@material/web/all'
import type { MdOutlinedTextField, MdDialog, MdFab, MdFilledButton, MdIconButton } from '@material/web/all'
import { i18n } from './i18n'
import { MainMenu } from './main_menu/main_menu'
import { Cli } from './cli'
import { Config } from './config'
import { ConfigLegacy } from './config_legacy'
import { AppList } from './app_list/app_list'
import { Snackbar } from './snackbar/snackbar'
import { FileSelector } from './file_selector/file_selector'
import { History } from './history'
import { Keybox } from './keybox/keybox'
import { DialogController } from './dialog/dialog'
import { UpdateManager } from './update'
import { SearchBar } from './search_bar/search_bar'
import { Keybind } from './keybind'
import { LOCAL_STORAGE_PREFIX } from './constant'
import './style.scss'

await i18n.init()

const snackbar = new Snackbar()
const fileSelector = new FileSelector()
const cli = new Cli()
const history = new History()
const keybind = new Keybind()
const updateManager = new UpdateManager(cli)

let config: Config
try {
  const tsInfo = await cli.getTrickyStoreInfo()
  const versionCode = parseInt(tsInfo.versionCode, 10)
  config = createConfig(versionCode)
} catch {
  config = new Config()
}

function createConfig(versionCode: number): Config {
  if (isNaN(versionCode)) return new Config()

  switch (true) {
    case Config.support(versionCode):
      return new Config()         // config.ini
    default:
      return new ConfigLegacy()   // target.txt + security_patch.txt
  }
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = /* html */ `
  <section class="header">
    <div id="title" class="search-hide">${i18n.t('header_title')}</div>
    <div class="spacer"></div>
    <md-icon-button id="search-button" class="search-hide"><md-icon>search</md-icon></md-icon-button>
    <md-outlined-text-field class="search-bar hide">
      <md-icon-button slot="trailing-icon" id="search-close"><md-icon>close</md-icon></md-icon-button>
    </md-outlined-text-field>
  </section>

  <section class="body-content">
    <div class="update hide">
      <md-icon>cloud_download</md-icon>
      <div class="update-text">
        <span>${i18n.t('update_update_available')}</span>
        <em>${i18n.t('update_redirect_to_release')}</em>
      </div>
      <md-ripple></md-ripple>
    </div>
    <div class="app-list">
      <div class="loading"><md-circular-progress indeterminate></md-circular-progress></div>
    </div>
    <div class="uninstall">
      <md-filled-button id="uninstall">
        <md-icon slot="icon">delete</md-icon>
        ${i18n.t('functional_button_uninstall_webui')}
      </md-filled-button>
    </div>
    <div class="bottom-safe-inset"></div>
  </section>

  <section class="floating-content fab-hide">
    ${snackbar.html()}
    <div class="fab-container">
      <md-fab variant="primary" class="fab fab-hide" id="save" label="${i18n.t('functional_button_save')}">
        <md-icon slot="icon">edit_note</md-icon>
      </md-fab>
    </div>
  </section>

  <section class="dialog-content"></section>
`

// App List
const appList = new AppList(config, cli)
await config.read()
await appList.fetch()
appList.syncSystemAppsWithConfig()
const appListContainer = document.querySelector<HTMLElement>('.app-list')!
appList.renderAppList(appListContainer)
float(false)

// Search bar
const searchBar = new SearchBar(history)
const searchBarEl = document.querySelector<MdOutlinedTextField>('.search-bar')!
const searchHide = document.querySelectorAll<HTMLElement>('.search-hide')
const searchButton = document.getElementById('search-button') as MdIconButton
searchBar.init(searchBarEl, searchHide, appListContainer)
searchButton.onclick = () => searchBar.show()

// Save App List
const saveFab = document.getElementById('save') as MdFab
saveFab.onclick = () => saveTarget()
async function saveTarget(): Promise<void> {
  try {
    await appList.save()
    await appList.refresh()
    snackbar.show(i18n.t('prompt_saved_target'))
  } catch (e) {
    snackbar.show(i18n.t('prompt_save_error'), false)
  }
}

/**
 * Toggle visibility of floating content
 * @param hide True to hide, false to show
 */
function float(hide: boolean): void {
  document.querySelectorAll('.floating-content, .fab').forEach(el => el.classList.toggle('fab-hide', hide))
}

// Main Menu events
const mainMenu = new MainMenu()
const keybox = new Keybox(cli, fileSelector, snackbar)
const header = document.querySelector<HTMLElement>('.header')!
mainMenu.appendTo(header)
mainMenu.on('menu-open', () => appList.menuOpen = true)
mainMenu.on('menu-close', () => appList.menuOpen = false)
mainMenu.on('menu-refresh', async () => await appList.refresh())
mainMenu.on('menu-select-all', () => appList.selectAll())
mainMenu.on('menu-deselect-all', () => appList.deselectAll())
mainMenu.on('menu-keybox-aosp', async () => await keybox.setAospKey())
mainMenu.on('menu-keybox-unknown', async () => await keybox.setUnknownKey())
mainMenu.on('menu-keybox-local', async () => await keybox.setLocalKey())
mainMenu.on('menu-add-system-app', () => dialogController.showSystemApp())
mainMenu.on('menu-select-denylist', async () => appList.fetchDenyList())
mainMenu.on('menu-deselect-unnecessary', async () => appList.deselectUnnecessary())
mainMenu.on('menu-prop-setting', () => dialogController.showProp())
mainMenu.on('menu-default-policy', () => dialogController.showDefaultPolicy())
mainMenu.on('menu-help', () => dialogController.showHelp())
mainMenu.on('menu-about', () => dialogController.showAbout())
mainMenu.on('menu-i18n-guide', () => dialogController.showI18nDialog())
if ((await cli.getManager()) !== 'MAGISK' && !import.meta.env.DEV) {
  mainMenu.hideItem('select-denylist') // Hide 'select from denylist'
}
if (!Keybox.isKeygenAvailable() && !import.meta.env.DEV) {
  mainMenu.hideItem('keybox-unknown') // Hide 'Unknown keybox'
}

const updateCard = document.querySelector<HTMLElement>('.update')!
let pendingChangelog: string | null = null

// Check module update
async function checkUpdate(): Promise<void> {
  const channel = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}UpdateChannel`) || 'stable'
  if (channel === 'disable') {
    updateManager.showModule(false)
    return
  }
  try {
    const info = await updateManager.checkUpdate(channel as 'stable' | 'canary')
    updateCard.classList.toggle('hide', !info.available)
    if (!info.available) return
    snackbar.show(i18n.t('prompt_new_update'))
    pendingChangelog = await updateManager.getChangelog(channel as 'stable' | 'canary', info.versionCode)
    updateCard.onclick = () => {
      if (pendingChangelog) dialogController.showUpdate(pendingChangelog)
    }
  } catch {
    updateCard.classList.add('hide')
  }
}
checkUpdate().catch(() => {})
document.addEventListener('update-channel-changed', () => checkUpdate())

// Keyboard shortcut events
keybind.on('keybind-select-all', () => appList.selectAll())
keybind.on('keybind-deselect-all', () => appList.deselectAll())
keybind.on('keybind-search', () => searchBar.show())
keybind.on('keybind-save', () => saveTarget())
keybind.on('keybind-esc', () => history.back())

// Dialog
const dialogController = new DialogController(cli, config, updateManager, snackbar, appList)
const dialogContent = document.querySelector<HTMLElement>('.dialog-content')!
fileSelector.appendTo(dialogContent)
keybox.appendTo(dialogContent)
keybox.custom.renderEntries()
dialogController.appendAll(dialogContent)
dialogContent.querySelectorAll<MdDialog>('md-dialog').forEach((dialog, i) => {
  const id = dialog.id || `md-dialog-${i}`
  dialog.addEventListener('open', () => history.push(id, () => dialog.close()))
  dialog.addEventListener('closed', () => history.consume(id))
})

// Uninstall webui
const uninstallBtn = document.getElementById('uninstall') as MdFilledButton
uninstallBtn.onclick = async () => {
  dialogController.showUninstall()
}

// Scroll event
let lastScrollY = window.scrollY
window.onscroll = () => {
  document.querySelectorAll('md-menu').forEach(menu => menu.close())
  float(window.scrollY > lastScrollY && window.scrollY > 48)
  document.querySelector('.header')?.classList.toggle('scroll', window.scrollY > 10)
  lastScrollY = window.scrollY
}
