import { io } from 'kernelsu-alt'
import { File } from './file'

export class KsuIo extends File {
  async exist(path: string): Promise<boolean> {
    return io.File(path).exists()
  }

  async isDirectory(path: string): Promise<boolean> {
    return io.File(path).isDirectory()
  }

  async read(path: string): Promise<string> {
    const source = io.File(path)
    if (!source.isFile()) throw new Error(`File.read failed: ${path}`)
    const stream = io.FileInputStream()
    const id = stream.open(path)
    if (!id) throw new Error(`File.read failed: ${path}`)
    const decoder = new TextDecoder()
    let content = ''
    let bytesRead = 0
    try {
      const length = source.length()
      while (bytesRead < length) {
        const chunk = stream.read(id, 32768)
        if (!chunk) throw new Error(`File.read failed: ${path}`)
        const bytes = Uint8Array.from(atob(chunk), char => char.charCodeAt(0))
        bytesRead += bytes.length
        if (bytesRead > length) throw new Error(`File.read failed: ${path}`)
        content += decoder.decode(bytes, { stream: true })
      }
      return content + decoder.decode()
    } finally {
      if (!stream.close(id)) throw new Error(`File.read failed to close: ${path}`)
    }
  }

  async write(path: string, data: string): Promise<void> {
    const stream = io.FileOutputStream()
    const id = stream.open(path, false)
    if (!id) throw new Error(`File.write failed: ${path}`)
    const bytes = new TextEncoder().encode(`${data.trim()}\n`)
    try {
      for (let offset = 0; offset < bytes.length; offset += 32768) {
        const chunk = bytes.subarray(offset, offset + 32768)
        let binary = ''
        for (const byte of chunk) binary += String.fromCharCode(byte)
        if (!stream.write(id, btoa(binary))) throw new Error(`File.write failed: ${path}`)
      }
      if (!stream.flush(id)) throw new Error(`File.write failed: ${path}`)
    } finally {
      if (!stream.close(id)) throw new Error(`File.write failed to close: ${path}`)
    }
  }

  async move(src: string, dst: string): Promise<void> {
    const source = io.File(src)
    if (!source.exists()) throw new Error(`File.move failed: ${src} does not exist`)
    const target = io.File(dst).isDirectory() ? `${dst}/${source.getName()}` : dst
    if (io.File(target).exists() || io.File(target).isSymlink()) await this.delete(target)
    if (!source.renameTo(target)) throw new Error(`File.move failed: ${src} -> ${target}`)
  }

  async copy(src: string, dst: string): Promise<void> {
    const source = io.File(src)
    if (!source.exists() && !source.isSymlink()) throw new Error(`File.copy failed: ${src} does not exist`)

    const target = io.File(dst).isDirectory() ? `${dst}/${source.getName()}` : dst
    if (source.isSymlink()) {
      if (io.File(target).exists() || io.File(target).isSymlink()) await this.delete(target)
      if (!io.File(target).createNewSymlink(source.getCanonicalPath())) {
        throw new Error(`File.copy failed: ${src} -> ${target}`)
      }
    } else if (source.isDirectory()) {
      await this.createDirectory(target)
      for (const child of source.list()) {
        await this.copy(`${src}/${child}`, target)
      }
    } else {
      if (!source.isFile()) throw new Error(`File.copy failed: ${src} is not a file`)
      const input = io.FileInputStream()
      const output = io.FileOutputStream()
      const inputId = input.open(src)
      if (!inputId) throw new Error(`File.copy failed to open: ${src}`)
      let outputId: string | null = null
      let bytesRead = 0
      try {
        const length = source.length()
        outputId = output.open(target, false)
        if (!outputId) throw new Error(`File.copy failed to open: ${target}`)
        while (bytesRead < length) {
          const chunk = input.read(inputId, 32768)
          if (!chunk) throw new Error(`File.copy failed to read: ${src}`)
          bytesRead += atob(chunk).length
          if (bytesRead > length) throw new Error(`File.copy failed to read: ${src}`)
          if (!output.write(outputId, chunk)) throw new Error(`File.copy failed: ${src} -> ${target}`)
        }
        if (!output.flush(outputId)) throw new Error(`File.copy failed: ${src} -> ${target}`)
      } finally {
        try {
          if (!input.close(inputId)) throw new Error(`File.copy failed to close: ${src}`)
        } finally {
          if (outputId !== null && !output.close(outputId)) throw new Error(`File.copy failed to close: ${target}`)
        }
      }
    }
  }

  async delete(path: string): Promise<void> {
    const file = io.File(path)
    if ((file.exists() || file.isSymlink()) && !file.deleteRecursive()) throw new Error(`File.delete failed: ${path}`)
  }

  async createFile(path: string): Promise<void> {
    const file = io.File(path)
    if (!file.exists() && !file.createNewFile()) throw new Error(`File.createFile failed: ${path}`)
  }

  async createDirectory(dir: string): Promise<void> {
    const file = io.File(dir)
    if (!file.isDirectory() && !file.mkdirs()) throw new Error(`File.createDirectory failed: ${dir}`)
  }
}
