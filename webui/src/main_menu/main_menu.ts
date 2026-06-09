import type { MdIconButton, MdMenuItem, MdMenu, MdSubMenu } from '@material/web/all'
import { i18n } from '../i18n'
import './main_menu.scss'

export class MainMenu {
  #callbacks = new Map<string, Array<() => void>>()

  appendTo(container: HTMLElement): void {
    container.appendChild(this.#getElement(container))
  }

  #getElement(el: HTMLElement): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-menu id="menu-options" anchor="menu-button">
        <div class="menu-item-button-container">
          <md-filled-tonal-icon-button id="select-all"><md-icon>select_all</md-icon></md-filled-tonal-icon-button>
          <md-filled-tonal-icon-button id="deselect-all"><md-icon>deselect</md-icon></md-filled-tonal-icon-button>
          <md-filled-tonal-icon-button id="refresh"><md-icon>refresh</md-icon></md-filled-tonal-icon-button>
        </div>
        <md-divider role="separator" tabindex="-1"></md-divider>
        <md-menu-item id="select-denylist">
          <div slot="headline">${i18n.t('menu_select_denylist')}</div>
        </md-menu-item>
        <md-menu-item id="deselect-unnecessary">
          <div slot="headline">${i18n.t('menu_deselect_unnecessary')}</div>
        </md-menu-item>
        <md-menu-item id="add-system-app">
          <div slot="headline">${i18n.t('menu_add_system_app')}</div>
        </md-menu-item>
        <md-divider role="separator" tabindex="-1"></md-divider>
        <md-sub-menu hover-close-delay="0" id="keybox-menu">
          <md-menu-item slot="item" class="sub-menu-entry">
            <div slot="headline">${i18n.t('menu_keybox')}</div>
            <md-icon slot="end">key</md-icon>
          </md-menu-item>
          <md-menu positioning="popover" slot="menu" x-offset="2">
            <md-menu-item id="keybox-aosp">
              <div slot="headline">${i18n.t('menu_keybox_aosp')}</div>
            </md-menu-item>
            <md-menu-item id="keybox-unknown">
              <div slot="headline">${i18n.t('menu_keybox_unknown')}</div>
            </md-menu-item>
            <md-menu-item id="keybox-local">
              <div slot="headline">${i18n.t('menu_keybox_local')}</div>
            </md-menu-item>
            <md-menu-item id="keybox-repo">
              <div slot="headline">${i18n.t('menu_keybox_repo')}</div>
              <md-icon slot="end">open_in_new</md-icon>
            </md-menu-item>
            <md-divider role="separator" tabindex="-1"></md-divider>
            <md-menu-item id="keybox-custom" class="icon-item">
              <div class="icon-button-item">
                <md-filled-tonal-icon-button><md-icon>add</md-icon></md-filled-tonal-icon-button>
              </div>
            </md-menu-item>
          </md-menu>
        </md-sub-menu>
        <md-menu-item id="prop-setting">
          <div slot="headline">${i18n.t('menu_prop_setting')}</div>
        </md-menu-item>
        <md-menu-item id="default-policy">
          <div slot="headline">${i18n.t('menu_set_default_policy')}</div>
        </md-menu-item>
        <md-divider role="separator" tabindex="-1"></md-divider>
        <md-menu-item id="help">
          <div slot="headline">${i18n.t('menu_help')}</div>
        </md-menu-item>
        <md-sub-menu hover-close-delay="0">
          <md-menu-item slot="item" class="sub-menu-entry">
            <div slot="headline">${i18n.t('menu_language')}</div>
            <md-icon slot="end">language</md-icon>
          </md-menu-item>
          <md-menu positioning="popover" slot="menu" id="language-menu" x-offset="2"></md-menu>
        </md-sub-menu>
        <md-menu-item id="about">
          <div slot="headline">${i18n.t('menu_about')}</div>
        </md-menu-item>
      </md-menu>
    `

    const fragment = template.content
    const menuOptions = fragment.querySelector('#menu-options') as MdMenu

    el.querySelector<MdIconButton>('#menu-button')!.onclick = () => {
      menuOptions.open = !menuOptions.open
    }

    menuOptions.addEventListener('opened', () => this.#emit('menu-open'))
    menuOptions.addEventListener('closed', () => this.#emit('menu-close'))

    const items: Array<[string, string]> = [
      ['select-all', 'menu-select-all'],
      ['deselect-all', 'menu-deselect-all'],
      ['refresh', 'menu-refresh'],
      ['select-denylist', 'menu-select-denylist'],
      ['deselect-unnecessary', 'menu-deselect-unnecessary'],
      ['add-system-app', 'menu-add-system-app'],
      ['keybox-aosp', 'menu-keybox-aosp'],
      ['keybox-unknown', 'menu-keybox-unknown'],
      ['keybox-local', 'menu-keybox-local'],
      ['keybox-repo', 'menu-keybox-repo'],
      ['keybox-custom', 'menu-keybox-custom'],
      ['prop-setting', 'menu-prop-setting'],
      ['default-policy', 'menu-default-policy'],
      ['help', 'menu-help'],
      ['about', 'menu-about'],
    ]

    items.forEach(([id, event]) => {
      const el = fragment.querySelector<MdMenuItem>(`#${id}`)
      if (el) {
        el.onclick = () => {
          this.#emit(event)
          menuOptions.open = false
        }
      }
    })

    // Override default behaviour
    let menuOpen = false
    fragment.querySelectorAll('.sub-menu-entry').forEach(entry => {
      const item = entry as MdMenuItem
      const menu = item.parentElement as MdSubMenu
      item.onclick = (e) => {
        e.stopPropagation()
        menuOpen = !menuOpen
        menuOpen ? menu.show() : menu.close()
      }
      menu.querySelector('md-menu')?.addEventListener('opening', () => menuOpen = true)
      menu.querySelector('md-menu')?.addEventListener('closing', () => menuOpen = false)
    })

    // Generate language menu
    const languageMenu = fragment.querySelector('#language-menu')
    if (languageMenu) {
      languageMenu.innerHTML = ''
      const currentSaved = i18n.lang
      const langs = { default: i18n.t('system_default'), ...i18n.languages }
      for (const [code, name] of Object.entries(langs)) {
        const item = document.createElement('md-menu-item')
        item.id = `lang-${code}`
        if (currentSaved === code) {
          item.setAttribute('selected', '')
        }
        item.innerHTML = `<div slot="headline">${name}</div>`
        item.onclick = () => {
          i18n.setLanguage(code)
        }
        languageMenu.appendChild(item)
      }

      // Translation guide
      const divider = document.createElement('md-divider')
      divider.setAttribute('role', 'separator')
      divider.setAttribute('tabindex', '-1')
      languageMenu.appendChild(divider)

      const guideItem = document.createElement('md-menu-item')
      guideItem.innerHTML = `<div slot="headline">${i18n.t('more_language')}</div>`
      guideItem.onclick = () => {
        this.#emit('menu-i18n-guide')
        menuOptions.open = false
      }
      languageMenu.appendChild(guideItem)
    }

    return fragment
  }

  hideItem(id: string): void {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  }

  on(event: string, callback: () => void): void {
    const cbs = this.#callbacks.get(event) ?? []
    cbs.push(callback)
    this.#callbacks.set(event, cbs)
  }

  #emit(event: string): void {
    this.#callbacks.get(event)?.forEach(cb => cb())
  }
}
