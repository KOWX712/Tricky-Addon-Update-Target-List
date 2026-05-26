/**
 * History - Generic browser history state manager.
 *
 * Manages a parallel key stack in sync with window.history. When the user
 * navigates back (back button / gesture), the matching entry is popped and
 * its onBack callback fires.
 *
 * Usage:
 *   const history = new History()
 *
 *   // Push a state when opening a component:
 *   history.push('about', () => component.close())
 *
 *   // When the component is dismissed externally (e.g. scrim click),
 *   // tell history to clean up without triggering onBack:
 *   component.onDismiss(() => history.consume('about'))
 *
 *   // Programmatic back:
 *   closeButton.onclick = () => history.back()
 */
export class History {
  /** Keys in push order, mirroring the browser history stack */
  #activeKeys: string[] = []
  /** Map of key → onBack callback */
  #entries = new Map<string, () => void>()

  #boundPopState: (event: PopStateEvent) => void

  constructor() {
    this.#boundPopState = this.#onPopState.bind(this)
    window.addEventListener('popstate', this.#boundPopState)
  }

  /**
   * Push a new history state.
   * @param key - Unique identifier for this entry
   * @param onBack - Callback invoked when the user navigates back
   */
  push(key: string, onBack: () => void): void {
    this.#activeKeys.push(key)
    this.#entries.set(key, onBack)
    window.history.pushState({ key }, '')
  }

  back(): void {
    window.history.back()
  }

  /**
   * Mark a tracked entry as consumed externally (e.g. component was
   * dismissed before back navigation occurred).
   *
   * Removes the entry from tracking and calls window.history.back()
   * to clean up the stale history entry. Calling consume() on an
   * already-consumed or non-existent key is a safe no-op.
   *
   * @returns true if the entry existed and was consumed
   */
  consume(key: string): boolean {
    if (!this.#entries.has(key)) return false

    this.#activeKeys = this.#activeKeys.filter(k => k !== key)
    this.#entries.delete(key)
    window.history.back()
    return true
  }

  destroy(): void {
    window.removeEventListener('popstate', this.#boundPopState)
    this.#activeKeys = []
    this.#entries.clear()
  }

  /** Number of tracked entries currently on the stack */
  get size(): number {
    return this.#activeKeys.length
  }

  /**
   * Compares the current browser state key against our tracked keys
   * to determine which entries were popped by back/forward navigation.
   */
  #onPopState(event: PopStateEvent): void {
    const currentKey = event.state?.key as string | undefined

    while (this.#activeKeys.length > 0) {
      const lastKey = this.#activeKeys[this.#activeKeys.length - 1]
      if (lastKey === currentKey) break
      this.#activeKeys.pop()
      const onBack = this.#entries.get(lastKey)
      if (onBack) {
        this.#entries.delete(lastKey)
        onBack()
      }
    }
  }
}
