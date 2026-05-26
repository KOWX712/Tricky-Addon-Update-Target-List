import { MdFilledButton, type MdDialog, type MdIconButton, type MdOutlinedButton, type MdOutlinedTextField } from '@material/web/all'
import { i18n } from '../i18n'
import { AppList } from '../app_list/app_list'
import { applyDialogAnimation } from './animation'

export class SystemAppDialog {
  #dialog: MdDialog | null = null
  #appList: AppList

  constructor(appList: AppList) {
    this.#appList = appList
  }

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="system-app-dialog">
        <div slot="headline">
          ${i18n.t('add_system_app_title')}
          <md-outlined-text-field id="system-app-search" placeholder="${i18n.t('search_bar_search_placeholder')}">
            <md-icon slot="leading-icon">search</md-icon>
            <md-icon-button id="system-app-search-close" slot="trailing-icon" style="display:none"><md-icon>close</md-icon></md-icon-button>
          </md-outlined-text-field>
        </div>
        <div slot="content">
          <div id="system-app-list"></div>
        </div>
        <div slot="actions">
          <md-outlined-button id="cancel-system-app">${i18n.t('functional_button_cancel')}</md-outlined-button>
          <md-filled-button id="save-system-app">${i18n.t('functional_button_save')}</md-filled-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('#system-app-dialog')

    const searchField = fragment.querySelector<MdOutlinedTextField>('#system-app-search')!
    const searchClose = fragment.querySelector<MdIconButton>('#system-app-search-close')!

    searchField.addEventListener('input', () => {
      this.#filterList(searchField.value)
      searchClose.style.display = searchField.value ? '' : 'none'
    })

    searchClose.onclick = () => {
      searchField.value = ''
      this.#filterList('')
      searchClose.style.display = 'none'
      searchField.focus()
    }

    fragment.querySelector<MdOutlinedButton>('#cancel-system-app')!.onclick = () => this.close()
    fragment.querySelector<MdFilledButton>('#save-system-app')!.onclick = () => this.#save()

    return fragment
  }

  #filterList(query: string): void {
    const listContainer = this.#dialog?.querySelector('#system-app-list')
    if (!listContainer) return
    const normalized = query.toLowerCase().trim()
    listContainer.querySelectorAll<HTMLElement>('.card-box').forEach(card => {
      const text = card.textContent?.toLowerCase() ?? ''
      card.style.display = !normalized || text.includes(normalized) ? '' : 'none'
    })
  }

  initAnimation(): void {
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  show(): void {
    const container = this.#dialog?.querySelector<HTMLElement>('#system-app-list')
    if (container) {
      this.#appList.renderSystemAppList(container)
    }
    const searchField = this.#dialog?.querySelector<MdOutlinedTextField>('#system-app-search')
    if (searchField) {
      searchField.value = ''
    }
    const searchClose = this.#dialog?.querySelector<MdIconButton>('#system-app-search-close')
    if (searchClose) {
      searchClose.style.display = 'none'
    }
    this.#dialog?.show()
  }

  close(): void {
    this.#dialog?.close()
  }

  async #save(): Promise<void> {
    const listContainer = this.#dialog?.querySelector<HTMLElement>('#system-app-list')
    if (!listContainer) return

    const checkedApps: string[] = []
    listContainer.querySelectorAll<HTMLElement>('.card').forEach(card => {
      const checkbox = card.querySelector('md-checkbox')!
      if (checkbox.checked && card.dataset.package) {
        checkedApps.push(card.dataset.package)
      }
    })

    await this.#appList.saveSystemAppSelection(checkedApps)
    this.close()
  }
}
