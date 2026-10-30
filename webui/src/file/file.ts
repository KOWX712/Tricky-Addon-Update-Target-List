export abstract class File {
  abstract exist(path: string): Promise<boolean>
  abstract isDirectory(path: string): Promise<boolean>
  abstract read(path: string): Promise<string>
  abstract write(path: string, data: string): Promise<void>
  abstract move(src: string, dst: string): Promise<void>
  abstract copy(src: string, dst: string): Promise<void>
  abstract delete(path: string): Promise<void>
  abstract createFile(path: string): Promise<void>
  abstract createDirectory(dir: string): Promise<void>
}
