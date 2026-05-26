import type { MdDialog, MdOutlinedTextField, MdTextButton } from '@material/web/all'
import type { Keybox } from './keybox'
import { i18n } from '../i18n'
import { File } from '../file'
import { FileSelector } from '../file_selector/file_selector'
import { Snackbar } from '../snackbar/snackbar'
import { LOCAL_STORAGE_PREFIX, GITHUB_REPO } from '../constant'

interface CustomKeyboxEntry {
  name: string
  link: string
  script: string
}

const STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}Customkb`
const CONFIG_METADATA = 'tricky_addon_custom_keybox_config'
const BLOCKED_PATTERNS = /\b(dd|rm|rmdir|eval|chmod|chown|mv|cp|ln|passwd|shutdown|reboot|poweroff)\b/i
const DEFAULT_ENTRIES: CustomKeyboxEntry[] = [
  { name: 'Addon', link: `https://raw.githubusercontent.com/${GITHUB_REPO}/keybox/.extra`, script: 'xxd -r -p | base64 -d' }
]

export class CustomKeyboxProvider {
  #keybox: Keybox
  #fileSelector: FileSelector
  #snackbar: Snackbar
  #currentEditName: string | null = null
  #isReset = false

  constructor(keybox: Keybox, fileSelector: FileSelector, snackbar: Snackbar) {
    this.#keybox = keybox
    this.#fileSelector = fileSelector
    this.#snackbar = snackbar
  }

  bind(fragment: DocumentFragment): void {
    const dialog = fragment.querySelector<MdDialog>('#customkb-dialog')
    const removeDialog = fragment.querySelector<MdDialog>('#customkb-remove-dialog')
    if (!dialog || !removeDialog) return

    document.getElementById('keybox-custom')!.onclick = () => {
      this.#resetDialogInputs()
      this.#currentEditName = null
      dialog.show()
    }

    dialog.querySelector<MdTextButton>('#cancel-customkb')!.onclick = () => {
      dialog?.close()
    }

    dialog.querySelector<MdTextButton>('#save-customkb')!.onclick = this.#saveEntry.bind(this)
    dialog.querySelector<MdTextButton>('#reset-customkb')!.onclick = () => this.#showRemoveDialog(true)
    dialog.querySelector<MdTextButton>('#remove-customkb')!.onclick = () => this.#showRemoveDialog(false, this.#currentEditName)
    dialog.querySelector<MdTextButton>('#customkb-import')!.onclick = this.#importConfig.bind(this)
    dialog.querySelector<MdTextButton>('#customkb-export')!.onclick = this.#exportConfig.bind(this)

    removeDialog.querySelector<MdTextButton>('#cancel-remove-customkb')!.onclick = () => {
      removeDialog.close()
      this.#isReset = false
      this.#currentEditName = null
    }
    removeDialog.querySelector<MdTextButton>('#confirm-remove-customkb')!.onclick = this.#removeEntry.bind(this)

    dialog.querySelectorAll<MdOutlinedTextField>('#customkb-name-input, #customkb-link-input').forEach((input) => {
      input.addEventListener('input', () => {
        const val = input.value.trim()
        input.error = !val
        input.querySelector('md-icon[slot="trailing-icon"]')?.classList.toggle('hidden', !!val)
      })
    })

    const scriptInput = dialog.querySelector<MdOutlinedTextField>('#customkb-script-input')
    scriptInput?.addEventListener('input', () => {
      const value = scriptInput.value.trim()
      scriptInput.error = !!value && !this.#validateScript(value)
      scriptInput.querySelector('md-icon[slot="trailing-icon"]')?.classList.toggle('hidden', !scriptInput.error)
    })
  }

  renderEntries(): void {
    const entries = this.#getEntries()
    const customkb = document.getElementById('keybox-custom')
    if (!customkb) return

    document.querySelectorAll('.customkb-entry').forEach(el => el.remove())

    if (entries.length === 0) return

    entries.forEach((entry, index) => {
      const menuItem = document.createElement('md-menu-item')
      menuItem.className = 'customkb-entry'
      if (index === 0) menuItem.classList.add('first')
      menuItem.textContent = entry.name
      customkb.parentNode!.insertBefore(menuItem, customkb)
      menuItem.onclick = () => this.#fetchKeybox(entry.link, entry.script)
      menuItem.oncontextmenu = (e) => {
        e.preventDefault()
        this.#showEditDialog(entry)
      }
    })
  }

  #getEntries(): CustomKeyboxEntry[] {
    try {
      const entries = localStorage.getItem(STORAGE_KEY)
      if (!entries) throw new Error('No custom keybox entries found')
      return JSON.parse(entries) as CustomKeyboxEntry[]
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ENTRIES))
      return DEFAULT_ENTRIES
    }
  }

  #saveEntries(entries: CustomKeyboxEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }

  #validateScript(script: string): boolean {
    return !(script && BLOCKED_PATTERNS.test(script))
  }

  async #fetchKeybox(link: string, script: string): Promise<void> {
    try {
      if (script && !this.#validateScript(script)) {
        this.#snackbar.show(i18n.t('prompt_custom_invalid_script'), false)
        return
      }

      const response = await fetch(link)
      if (!response.ok) {
        this.#snackbar.show(i18n.t('prompt_custom_fetch_error') + `: ${response.status}`, false)
        return
      }

      const data = await response.text()

      if (data.trim() === '') {
        this.#snackbar.show(i18n.t('prompt_custom_not_found'), false)
        return
      }

      const cmd = script || 'cat'
      const result = await this.#keybox.setKeybox(data, cmd)
      this.#snackbar.show(i18n.t(result ? 'prompt_custom_key_set' : 'prompt_custom_key_set_error'), result)
    } catch (error) {
      console.error(error)
      this.#snackbar.show(i18n.t('prompt_custom_fetch_error'), false)
    }
  }

  #showEditDialog(entry: CustomKeyboxEntry): void {
    const nameInput = document.getElementById('customkb-name-input') as HTMLInputElement | null
    const linkInput = document.getElementById('customkb-link-input') as HTMLInputElement | null
    const scriptInput = document.getElementById('customkb-script-input') as HTMLInputElement | null
    if (!nameInput || !linkInput || !scriptInput) return

    nameInput.value = entry.name
    linkInput.value = entry.link
    scriptInput.value = entry.script || ''

    document.querySelectorAll<HTMLElement>('#customkb-dialog .new').forEach(el => el.style.display = 'none')
    document.querySelectorAll<HTMLElement>('#customkb-dialog .old').forEach(el => el.style.display = '')

    this.#currentEditName = entry.name
    document.querySelector<MdDialog>('#customkb-dialog')!.show()
  }

  #resetDialogInputs(): void {
    const nameInput = document.getElementById('customkb-name-input') as HTMLInputElement | null
    const linkInput = document.getElementById('customkb-link-input') as HTMLInputElement | null
    const scriptInput = document.getElementById('customkb-script-input') as HTMLInputElement | null
    if (!nameInput || !linkInput || !scriptInput) return

    nameInput.value = ''
    linkInput.value = ''
    scriptInput.value = ''

    document.querySelectorAll<HTMLElement>('#customkb-dialog .new').forEach(el => el.style.display = '')
    document.querySelectorAll<HTMLElement>('#customkb-dialog .old').forEach(el => el.style.display = 'none')
  }

  #saveEntry(): void {
    const nameInput = document.getElementById('customkb-name-input') as HTMLInputElement | null
    const linkInput = document.getElementById('customkb-link-input') as HTMLInputElement | null
    const scriptInput = document.getElementById('customkb-script-input') as HTMLInputElement | null
    if (!nameInput || !linkInput || !scriptInput) return

    for (const input of [nameInput, linkInput]) {
      if (!input.value.trim()) {
        input.setAttribute('error', '')
        input.querySelector('md-icon[slot="trailing-icon"]')?.classList.remove('hidden')
        return
      }
    }

    if (!this.#validateScript(scriptInput.value.trim())) {
      this.#snackbar.show(i18n.t('prompt_custom_invalid_script'), false)
      return
    }

    const entries = this.#getEntries()
    const newEntry: CustomKeyboxEntry = {
      name: nameInput.value.trim(),
      link: linkInput.value.trim(),
      script: scriptInput.value.trim()
    }

    if (this.#currentEditName) {
      const index = entries.findIndex(e => e.name === this.#currentEditName)
      if (index !== -1) {
        entries[index] = newEntry
      }
    } else {
      entries.push(newEntry)
    }

    this.#saveEntries(entries)
    this.renderEntries()

    document.querySelector<MdDialog>('#customkb-dialog')!.close()
    this.#snackbar.show(i18n.t('prompt_custom_saved'), true)
  }

  #removeEntry(): void {
    if (this.#isReset) {
      this.#saveEntries(DEFAULT_ENTRIES)
      this.renderEntries()
      document.querySelector<MdDialog>('#customkb-remove-dialog')!.close()
      this.#snackbar.show(i18n.t('prompt_custom_removed'), true)
      this.#isReset = false
      return
    }

    if (!this.#currentEditName) return

    const entries = this.#getEntries().filter(e => e.name !== this.#currentEditName)
    this.#saveEntries(entries)
    this.renderEntries()

    document.querySelector<MdDialog>('#customkb-remove-dialog')!.close()
    this.#snackbar.show(i18n.t('prompt_custom_removed'), true)
    this.#currentEditName = null
  }

  #showRemoveDialog(reset: boolean, name?: string | null): void {
    this.#isReset = reset
    this.#currentEditName = name ?? null

    const singleEl = document.getElementById('customkb-remove-single')
    const resetEl = document.getElementById('customkb-reset')
    if (singleEl) singleEl.style.display = reset ? 'none' : ''
    if (resetEl) resetEl.style.display = reset ? '' : 'none'

    document.querySelector<MdDialog>('#customkb-remove-dialog')!.show()
    document.querySelector<MdDialog>('#customkb-dialog')!.close()
  }

  async #exportConfig(): Promise<void> {
    const entries = this.#getEntries()
    if (entries.length === 0) {
      this.#snackbar.show(i18n.t('customkb_export_empty'), false)
      return
    }

    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const fileName = `TA-keybox_config_${dateStr}.json`

    const config = {
      metadata: CONFIG_METADATA,
      version: 1,
      entries
    }

    try {
      const configStr = JSON.stringify(config, null, 2)
      const filePath = `/storage/emulated/0/Download/${fileName}`
      await File.write(filePath, configStr)
      this.#snackbar.show(i18n.t('customkb_export_success', filePath), true)
    } catch {
      this.#snackbar.show(i18n.t('customkb_export_error'), false)
    }
  }

  async #importConfig(): Promise<void> {
    const dialog = document.getElementById('customkb-dialog') as MdDialog | null
    dialog?.close()
    try {
      const content = await this.#fileSelector.getFileContent('json')
      if (!content) return
      const config = JSON.parse(content)

      if (!config || config.metadata !== CONFIG_METADATA || !Array.isArray(config.entries)) {
        this.#snackbar.show(i18n.t('customkb_import_error'), false)
        return
      }

      const updatedEntries: CustomKeyboxEntry[] = Array.from(new Map<string, CustomKeyboxEntry>([
        ...this.#getEntries().map(e => [e.name, e] as [string, CustomKeyboxEntry]),
        ...config.entries.map((e: CustomKeyboxEntry) => [e.name, e] as [string, CustomKeyboxEntry])
      ]).values())

      this.#saveEntries(updatedEntries)
      this.renderEntries()

      this.#snackbar.show(i18n.t('customkb_import_success'), true)
    } catch {
      this.#snackbar.show(i18n.t('customkb_import_error'), false)
    }
  }
}
