import { exec } from 'kernelsu-alt'
import { File } from './file'

export class ShellFile extends File {
  async exist(path: string): Promise<boolean> {
    const { errno } = await exec(`[ -e "${path}" ]`)
    return errno === 0
  }

  async isDirectory(path: string): Promise<boolean> {
    const { errno } = await exec(`[ -d "${path}" ]`)
    return errno === 0
  }

  async read(path: string): Promise<string> {
    const result = await exec(`cat "${path}"`)
    if (result.errno !== 0) throw new Error(`File.read failed (${result.errno}): ${result.stderr}`)
    return result.stdout
  }

  async write(path: string, data: string): Promise<void> {
    const result = await exec(`cat << 'FileEOF' > "${path}"
${data.trim()}
FileEOF`)
    if (result.errno !== 0) throw new Error(`File.write failed (${result.errno}): ${result.stderr}`)
  }

  async move(src: string, dst: string): Promise<void> {
    const result = await exec(`mv -f "${src}" "${dst}"`)
    if (result.errno !== 0) throw new Error(`File.move failed (${result.errno}): ${result.stderr}`)
  }

  async copy(src: string, dst: string): Promise<void> {
    const result = await exec(`cp -rf "${src}" "${dst}"`)
    if (result.errno !== 0) throw new Error(`File.copy failed (${result.errno}): ${result.stderr}`)
  }

  async delete(path: string): Promise<void> {
    const result = await exec(`rm -rf "${path}"`)
    if (result.errno !== 0) throw new Error(`File.delete failed (${result.errno}): ${result.stderr}`)
  }

  async createFile(path: string): Promise<void> {
    const result = await exec(`touch "${path}"`)
    if (result.errno !== 0) throw new Error(`File.createFile failed (${result.errno}): ${result.stderr}`)
  }

  async createDirectory(dir: string): Promise<void> {
    const result = await exec(`mkdir -p "${dir}"`)
    if (result.errno !== 0) throw new Error(`File.createDirectory failed (${result.errno}): ${result.stderr}`)
  }
}
