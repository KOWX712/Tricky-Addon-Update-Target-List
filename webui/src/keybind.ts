export class Keybind {
  #callbacks = new Map<string, Array<() => void>>()

  constructor() {
    document.addEventListener('keydown', (e) => this.#handleKeydown(e))
  }

  #handleKeydown(e: KeyboardEvent): void {
    const key = this.#resolveEvent(e)
    if (key) {
      e.preventDefault()
      e.stopPropagation()
      this.#emit(key)
    }
  }

  #resolveEvent(e: KeyboardEvent): string | null {
    const ctrl = e.ctrlKey
    const key = e.key.toLowerCase()

    if (ctrl && key === 'a') return 'keybind-select-all'
    if (ctrl && key === 'd') return 'keybind-deselect-all'
    if (ctrl && key === 'f') return 'keybind-search'
    if (ctrl && key === 's') return 'keybind-save'
    if (key === 'escape') return 'keybind-esc'

    return null
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
