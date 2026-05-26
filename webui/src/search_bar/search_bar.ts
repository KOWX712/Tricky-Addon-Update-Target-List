import type { MdOutlinedTextField, MdIconButton } from '@material/web/all'
import { History } from '../history'

export class SearchBar {
  #searchBar!: MdOutlinedTextField
  #searchHide!: NodeListOf<HTMLElement>
  #searchClose!: MdIconButton
  #appListContainer!: HTMLElement
  #history: History

  #filterActive = false

  constructor(history: History) {
    this.#history = history
  }

  init(searchBar: MdOutlinedTextField, searchHide: NodeListOf<HTMLElement>, appListContainer: HTMLElement): void {
    this.#searchBar = searchBar
    this.#searchHide = searchHide
    this.#appListContainer = appListContainer
    this.#searchClose = searchBar.querySelector<MdIconButton>('#search-close')!

    this.#searchClose.onclick = () => {
      if (this.#searchBar.value) {
        this.#searchBar.value = ''
        this.#applyFilter()
        this.#searchBar.focus()
      } else {
        this.#closeSearch()
      }
    }

    this.#searchBar.onblur = () => {
      if (!this.#searchBar.value) {
        this.#closeSearch()
      }
    }

    this.#searchBar.oninput = () => this.#applyFilter()
  }

  show(): void {
    this.#searchBar.classList.remove('hide')
    this.#searchHide.forEach(e => e.classList.add('hide'))
    this.#searchBar.focus()
    this.#history.push('search', () => this.#onBackSearch())
  }

  #showAllCards(): void {
    this.#appListContainer.querySelectorAll<HTMLElement>('.card-box').forEach(card => {
      card.style.display = ''
    })
  }

  #applyFilter(): void {
    const query = this.#searchBar.value.toLowerCase().trim()

    if (!query) {
      this.#showAllCards()
    } else {
      this.#appListContainer.querySelectorAll<HTMLElement>('.card-box').forEach(card => {
        const cardEl = card.querySelector('.card')
        const matches = cardEl!.textContent!.toLowerCase().includes(query)
        card.style.display = matches ? '' : 'none'
      })
    }

    const nowActive = !!query
    if (nowActive && !this.#filterActive) {
      this.#filterActive = true
      this.#history.push('search-filter', () => this.#onBackFilter())
    } else if (!nowActive && this.#filterActive) {
      this.#filterActive = false
      this.#history.consume('search-filter')
    }
  }

  #onBackSearch(): void {
    this.#filterActive = false
    this.#searchBar.value = ''
    this.#searchBar.classList.add('hide')
    this.#searchHide.forEach(e => e.classList.remove('hide'))
  }

  #onBackFilter(): void {
    this.#filterActive = false
    this.#searchBar.value = ''
    this.#applyFilter()
  }

  #closeSearch(): void {
    this.#filterActive = false
    this.#searchBar.value = ''
    this.#searchBar.classList.add('hide')
    this.#searchHide.forEach(e => e.classList.remove('hide'))
    this.#history.consume('search')
  }
}
