import { marked } from 'marked'
import type { Cli } from '../cli'
import './markdown.scss'

export function parseMarkdown(text: string): string {
  return marked.parse(text) as string
}

export function renderMarkdown(text: string, target: HTMLElement, cli: Cli): void {
  target.innerHTML = parseMarkdown(text)

  target.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (href?.startsWith('http://') || href?.startsWith('https://')) {
      const url = href
      a.href = 'javascript:void(0)'
      a.onclick = (e) => {
        e.preventDefault()
        cli.linkRedirect(url)
      }
    }
  })
}
