import { io } from 'kernelsu-alt'
import type { File } from './file'
import { KsuIo } from './ksuIo'
import { ShellFile } from './shellFile'

export const file: File = io.support ? new KsuIo() : new ShellFile()
