import './snackbar.scss'

export class Snackbar {
  #element: HTMLElement | null = null
  #textElement: HTMLElement | null = null
  #timer: ReturnType<typeof setTimeout> | null = null

  #swipeStartX = 0
  #swipeStartY = 0
  #swiping = false
  #currentX = 0

  html(): string {
    return /* html */ `
      <div class="snackbar hide">
        <div class="snackbar-text"></div>
      </div>`
  }

  show(msg: string, success: boolean = true, duration?: number): void {
    this.#ensureElements()
    if (!this.#element || !this.#textElement) return
    if (this.#timer) clearTimeout(this.#timer)

    this.#resetInlineStyles()
    this.#textElement.textContent = msg
    this.#element.classList.remove('hide')
    this.#element.classList.toggle('error', !success)

    this.#timer = setTimeout(() => {
      this.#element?.classList.add('hide')
    }, duration ?? 3000)
  }

  #ensureElements(): void {
    if (!this.#element) {
      this.#element = document.querySelector<HTMLElement>('.snackbar')
      this.#textElement = this.#element?.querySelector<HTMLElement>('.snackbar-text') ?? null
      if (this.#element) {
        this.#element.addEventListener('pointerdown', this.#onPointerDown)
      }
    }
  }

  #resetInlineStyles(): void {
    if (!this.#element) return
    this.#element.style.transition = ''
    this.#element.style.transform = ''
    this.#element.style.opacity = ''
    this.#swiping = false
    this.#currentX = 0
  }

  #onPointerDown = (e: PointerEvent): void => {
    if (!this.#element || this.#element.classList.contains('hide') || this.#swiping) return

    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = null
    }

    this.#swipeStartX = e.clientX
    this.#swipeStartY = e.clientY
    this.#currentX = 0

    document.addEventListener('pointermove', this.#onPointerMove)
    document.addEventListener('pointerup', this.#onPointerUp)
    document.addEventListener('pointercancel', this.#onPointerUp)
  }

  #onPointerMove = (e: PointerEvent): void => {
    if (!this.#element) return

    const deltaX = e.clientX - this.#swipeStartX
    const deltaY = e.clientY - this.#swipeStartY

    if (!this.#swiping && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
      this.#cleanupSwipeListeners()
      return
    }

    if (!this.#swiping && Math.abs(deltaX) > 5) {
      this.#swiping = true
    }

    if (!this.#swiping) return

    this.#currentX = deltaX
    this.#element.style.transition = 'none'
    this.#element.style.transform = `translateX(${deltaX}px)`

    const maxDistance = this.#element.offsetWidth * 0.5
    this.#element.style.opacity = String(Math.max(0, 1 - Math.abs(deltaX) / maxDistance))
  }

  #onPointerUp = (): void => {
    this.#cleanupSwipeListeners()
    if (!this.#element || !this.#swiping) return

    const threshold = this.#element.offsetWidth * 0.3

    if (Math.abs(this.#currentX) > threshold) {
      const sign = Math.sign(this.#currentX)
      this.#element.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
      this.#element.style.transform = `translateX(${sign * this.#element.offsetWidth}px)`
      this.#element.style.opacity = '0'

      setTimeout(() => {
        this.#element?.classList.add('hide')
        this.#resetInlineStyles()
      }, 300)
    } else {
      this.#element.style.transition = 'transform 0.3s ease, opacity 0.2s ease'
      this.#element.style.transform = ''
      this.#element.style.opacity = ''
      this.#swiping = false
      this.#currentX = 0
    }
  }

  #cleanupSwipeListeners(): void {
    document.removeEventListener('pointermove', this.#onPointerMove)
    document.removeEventListener('pointerup', this.#onPointerUp)
    document.removeEventListener('pointercancel', this.#onPointerUp)
  }
}
