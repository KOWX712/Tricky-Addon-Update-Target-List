import { LOCAL_STORAGE_PREFIX } from './constant'

interface Translations {
  [key: string]: string
}

export class I18nManager {
  static readonly STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}Language`

  static readonly #RTL_LANGUAGES: ReadonlySet<string> = new Set([
    'ar', // Arabic
    'fa', // Persian
    'he', // Hebrew
    'ur', // Urdu
    'ps', // Pashto
    'sd', // Sindhi
    'ku', // Kurdish
    'yi', // Yiddish
    'dv', // Dhivehi
  ])

  #currentLang = 'en'
  #translations: Translations = {}
  #baseTranslations: Translations = {}
  #availableLanguages: string[] = ['en']
  #languages: Record<string, string> = {}

  get lang(): string {
    return this.#currentLang
  }

  get languages(): Record<string, string> {
    return this.#languages
  }

  /**
   * Get a formatted translation string by key with optional arguments.
   *
   * Supported placeholders:
   *   - `%s`, `%d`, `%f`, `%x`       — positional arguments
   *   - `%1$s`, `%2$d`, `%3$f`, etc. — indexed arguments (1-based)
   *   - `%%`                         — literal percent sign
   *
   * Falls back to the key itself when no translation is found.
   */
  t(id: string, ...args: unknown[]): string {
    const translation = this.#translations[id] ?? this.#baseTranslations[id] ?? id
    if (args.length === 0) return translation

    let argIndex = 0
    return translation.replace(/%(?:(\d+)\$)?([%sdfx])/g, (_match, index, type) => {
      if (type === '%') return '%'
      if (index !== undefined) {
        const i = parseInt(index, 10) - 1
        return i < args.length ? String(args[i]) : _match
      }
      const arg = args[argIndex++]
      return arg !== undefined ? String(arg) : _match
    })
  }

  /**
   * Bootstrap the i18n system:
   *   1. Fetch and parse English base translations.
   *   2. Detect the user's preferred language.
   *   3. Merge user translations over the base (if not English).
   *   4. Set document direction (ltr / rtl).
   */
  async init(): Promise<void> {
    try {
      const baseResponse = await fetch('./locales/strings/en.xml')
      const baseXML = await baseResponse.text()
      this.#baseTranslations = this.#parseXml(baseXML)

      this.#currentLang = await this.#detectLanguage()

      if (this.#currentLang !== 'en') {
        const response = await fetch(`locales/strings/${this.#currentLang}.xml`)
        const userXML = await response.text()
        this.#translations = { ...this.#baseTranslations, ...this.#parseXml(userXML) }
      } else {
        this.#translations = this.#baseTranslations
      }

      this.#applyDirection()
    } catch (error) {
      console.error('Error loading translations:', error)
      this.#translations = this.#baseTranslations
    }
  }

  setLanguage(lang: string): void {
    if (this.#availableLanguages.includes(lang)) {
      localStorage.setItem(I18nManager.STORAGE_KEY, lang)
    } else {
      localStorage.removeItem(I18nManager.STORAGE_KEY)
    }
    window.location.reload()
  }

  #parseXml(xmlText: string): Translations {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    const nodes = doc.getElementsByTagName('string')
    const result: Translations = {}

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i]
      const name = el.getAttribute('name')
      if (name !== null) {
        result[name] = (el.textContent ?? '').replace(/\\n/g, '\n')
      }
    }

    return result
  }

  async #detectLanguage(): Promise<string> {
    const userLang = navigator.language || (navigator as unknown as Record<string, string>).userLanguage || ''
    const langCode = userLang.split('-')[0]

    try {
      const resp = await fetch('locales/languages.json')
      const data = await resp.json() as Record<string, string>

      this.#languages = data
      this.#availableLanguages = Object.keys(data)

      const preferred = localStorage.getItem(I18nManager.STORAGE_KEY)

      if (preferred !== null && preferred !== 'default' && this.#availableLanguages.includes(preferred)) {
        return preferred
      }

      if (this.#availableLanguages.includes(userLang)) return userLang
      if (this.#availableLanguages.includes(langCode)) return langCode

      localStorage.removeItem(I18nManager.STORAGE_KEY)
      return 'en'
    } catch (error) {
      console.error('Error detecting user language:', error)
      return 'en'
    }
  }

  #applyDirection(): void {
    const baseCode = this.#currentLang.split('-')[0]
    const isRTL = I18nManager.#RTL_LANGUAGES.has(baseCode)
    const dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
  }
}

export const i18n = new I18nManager()
