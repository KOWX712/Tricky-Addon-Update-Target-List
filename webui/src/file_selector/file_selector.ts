import { exec } from 'kernelsu-alt'
import type { MdDialog, MdIconButton, MdTextButton } from '@material/web/all'
import { i18n } from '../i18n'
import { applyDialogAnimation } from '../dialog/animation'
import './file_selector.scss'

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
}

export class FileSelector {
  #fileType = ''
  #fileSelectorMode: 'path' | 'content' = 'path'
  #currentPath = '/storage/emulated/0/Download'
  #resolvePromise: ((value: string | null) => void) | null = null
  #dialog: MdDialog | null = null
  #fileList: HTMLElement | null = null
  #currentPathEl: HTMLElement | null = null

  appendTo(container: HTMLElement): void {
    container.appendChild(this.#getElement())
    if (this.#dialog) applyDialogAnimation(this.#dialog)
  }

  #getElement(): DocumentFragment {
    const template = document.createElement('template')
    template.innerHTML = /* html */ `
      <md-dialog class="file-selector-dialog">
        <div slot="headline" class="file-selector-header">
          <md-icon-button class="back-button" flip-icon-in-rtl="true">
            <md-icon>arrow_back</md-icon>
          </md-icon-button>
          <div class="current-path">/storage/emulated/0/Download</div>
        </div>
        <div slot="content">
          <div class="file-list"></div>
        </div>
        <div slot="actions">
          <md-icon-button class="open-system-file">
            <md-icon>folder_open</md-icon>
          </md-icon-button>
          <div class="spacer"></div>
          <md-text-button class="close-selector">${i18n.t('functional_button_cancel')}</md-text-button>
        </div>
      </md-dialog>
    `

    const fragment = template.content
    this.#dialog = fragment.querySelector<MdDialog>('.file-selector-dialog')
    this.#fileList = this.#dialog?.querySelector('.file-list') ?? null
    this.#currentPathEl = this.#dialog?.querySelector('.current-path') ?? null

    this.#currentPathEl!.onclick = this.#onPathSegmentClick.bind(this)
    fragment.querySelector<MdIconButton>('.back-button')!.onclick = this.#navigateBack.bind(this)
    fragment.querySelector<MdTextButton>('.close-selector')!.onclick = this.#close.bind(this)
    fragment.querySelector<MdIconButton>('.open-system-file')!.onclick = this.#openSystemFile.bind(this)

    return fragment
  }

  #onPathSegmentClick(event: Event): void {
    const segment = (event.target as HTMLElement).closest('.path-segment') as HTMLElement | null
    if (!segment) return

    const targetPath = segment.dataset.path
    if (!targetPath || targetPath === this.#currentPath) return

    const clickedSegment = segment.textContent
    if ((clickedSegment === 'storage' || clickedSegment === 'emulated') &&
        this.#currentPath === '/storage/emulated/0') {
      return
    }

    if (targetPath.split('/').length <= 3) {
      this.#currentPath = '/storage/emulated/0'
    } else {
      this.#currentPath = targetPath
    }
    this.#updateCurrentPath()
    this.#listFiles(this.#currentPath)
  }

  #navigateBack(): void {
    if (this.#currentPath === '/storage/emulated/0') return
    this.#currentPath = this.#currentPath.split('/').slice(0, -1).join('/')
    if (this.#currentPath === '') this.#currentPath = '/storage/emulated/0'
    if (this.#currentPathEl) {
      this.#currentPathEl.innerHTML = this.#currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>')
      this.#currentPathEl.scrollTo({
        left: this.#currentPathEl.scrollWidth,
        behavior: 'smooth',
      })
    }
    this.#listFiles(this.#currentPath)
  }

  #openSystemFile(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file || !this.#resolvePromise) return
      if (!file.name.endsWith(`.${this.#fileType}`)) return

      if (this.#fileSelectorMode === 'content') {
        const reader = new FileReader()
        reader.onload = () => this.#resolve(reader.result as string)
        reader.readAsText(file)
      } else {
        this.#resolve(file.name)
      }
    }
    input.click()
  }

  getFilePath(type: string): Promise<string | null> {
    return this.#open(type, 'path')
  }

  getFileContent(type: string): Promise<string | null> {
    return this.#open(type, 'content')
  }

  async #open(type: string, mode: 'path' | 'content'): Promise<string | null> {
    this.#fileType = type
    this.#fileSelectorMode = mode
    this.#currentPath = '/storage/emulated/0/Download'

    const openSystemFile = this.#dialog?.querySelector<MdIconButton>('.open-system-file')
    if (openSystemFile) {
      openSystemFile.classList.toggle('hidden', mode === 'path')
    }

    this.#dialog?.show()

    if (this.#currentPathEl) {
      this.#currentPathEl.innerHTML = this.#currentPath.split('/').filter(Boolean).join('<span class="separator">›</span>')
      this.#currentPathEl.scrollTo({
        left: this.#currentPathEl.scrollWidth,
        behavior: 'smooth',
      })
    }

    await this.#listFiles(this.#currentPath, true)

    return new Promise((resolve) => {
      this.#resolvePromise = resolve
    })
  }

  async #listFiles(path: string, skipAnimation = false): Promise<void> {
    if (!this.#fileList) return

    if (!skipAnimation) {
      this.#fileList.classList.add('switching')
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    const result = await exec(`
      cd "${path}"
      for f in *; do
        [ -d "$f" ] && echo "d|$f" || { [[ "$f" == *.${this.#fileType} ]] && echo "f|$f"; }
      done | sort
    `)

    if (result.errno === 0) {
      this.#fileList.innerHTML = ''

      if (this.#currentPath !== '/storage/emulated/0') {
        const backItem = document.createElement('div')
        backItem.className = 'file-item'
        backItem.innerHTML = `
          <md-ripple></md-ripple>
          <md-icon>folder</md-icon>
          <span>..</span>
        `
        backItem.onclick = () => {
          this.#dialog?.querySelector<MdIconButton>('.back-button')?.click()
        }
        this.#fileList.appendChild(backItem)
      }

      const processedItems: FileItem[] = result.stdout.split('\n')
        .filter(Boolean)
        .map(line => {
          const [type, name] = [line.slice(0, 1), line.slice(2)]
          return { name, path: path + '/' + name, isDirectory: type === 'd' }
        })

      for (const item of processedItems) {
        const itemElement = document.createElement('div')
        itemElement.className = 'file-item'
        itemElement.innerHTML = `
          <md-ripple></md-ripple>
          <md-icon>${item.isDirectory ? 'folder' : 'description'}</md-icon>
          <span>${item.name}</span>
        `
        itemElement.onclick = () => {
          if (item.isDirectory) {
            this.#currentPath = item.path
            this.#updateCurrentPath()
            this.#listFiles(item.path)
          } else {
            this.#resolveFile(item.path)
          }
        }
        this.#fileList.appendChild(itemElement)
      }

      if (!skipAnimation) {
        this.#fileList.classList.remove('switching')
      }
    } else {
      console.error('Error listing files:', result.stderr)
      if (!skipAnimation) {
        this.#fileList.classList.remove('switching')
      }
    }
    this.#updateCurrentPath()
  }

  async #resolveFile(path: string): Promise<void> {
    if (this.#fileSelectorMode === 'content') {
      const execResult = await exec(`cat "${path}"`)
      if (execResult.errno === 0) {
        this.#resolve(execResult.stdout)
      } else {
        console.error(`Failed to read file content: ${execResult.stderr}`)
        this.#resolve(null)
      }
    } else {
      this.#resolve(path)
    }
  }

  #updateCurrentPath(): void {
    if (!this.#currentPathEl) return
    const segments = this.#currentPath.split('/').filter(Boolean)
    const pathHTML = segments.map((segment, index) => {
      const fullPath = '/' + segments.slice(0, index + 1).join('/')
      return `<span class="path-segment" data-path="${fullPath}">${segment}</span>`
    }).join('<span class="separator">›</span>')

    this.#currentPathEl.innerHTML = pathHTML
    this.#currentPathEl.scrollTo({
      left: this.#currentPathEl.scrollWidth,
      behavior: 'smooth',
    })
  }

  #resolve(value: string | null): void {
    this.#resolvePromise?.(value)
    this.#resolvePromise = null
    this.#close()
  }

  #close(): void {
    this.#dialog?.close()
    if (this.#resolvePromise) {
      this.#resolvePromise(null)
      this.#resolvePromise = null
    }
  }
}
