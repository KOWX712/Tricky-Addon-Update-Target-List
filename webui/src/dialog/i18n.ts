import type { MdDialog, MdTextButton } from '@material/web/all'
import { i18n } from '../i18n'
import type { Cli } from '../cli'
import { GITHUB_REPO } from '../constant'
import { applyDialogAnimation } from './animation'
import { renderMarkdown } from './markdown'

export class I18nDialog {
  private dialog: MdDialog | null = null
  private cli: Cli

  constructor(cli: Cli) {
    this.cli = cli
  }

  getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog id="i18n-dialog">
        <div slot="headline">${i18n.t('more_language')}</div>
        <div slot="content" class="markdown-content"></div>
        <div slot="actions">
          <md-text-button id="close-i18n">${i18n.t('functional_button_close')}</md-text-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.dialog = fragment.querySelector<MdDialog>('#i18n-dialog')

    fragment.querySelector<MdTextButton>('#close-i18n')!.onclick = () => this.close()

    return fragment
  }

  initAnimation(): void {
    if (this.dialog) applyDialogAnimation(this.dialog)
  }

  async show(): Promise<void> {
    if (!this.dialog) return

    const contentEl = this.dialog.querySelector<HTMLElement>('.markdown-content')
    if (!contentEl) return

    try {
      const link = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/webui/public/locales/GUIDE.md`
      let response = await fetch(link).catch(() => null)
      if (!response || !response.ok) {
        response = await fetch(`https://gh.sevencdn.com/${link}`)
      }
      if (!response.ok) throw new Error(`HTTP error status: ${response.status}`)
      const text = await response.text()
      renderMarkdown(text, contentEl, this.cli)
    } catch (error) {
      console.error('Error fetching guide:', error)
      contentEl.textContent = i18n.t('prompt_download_fail') || 'Failed to load guide.'
    }

    this.dialog.show()
  }

  close(): void {
    this.dialog?.close()
  }
}
