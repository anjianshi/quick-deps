import * as fs from 'fs'
import * as path from 'path'
import * as childProcess from 'child_process'
import logging from './logging'


/**
 * Check if the target file exists, and is a file
 */
export function fileExists(filepath: string) {
  return new Promise<boolean>(resolve => {
    fs.stat(filepath, (err, stat) => {
      resolve(!err && stat.isFile())
    })
  })
}


/**
 * Detect if two string target's to the same path
 */
export function isSamePath(a: string, b: string) {
  return path.resolve(a) === path.resolve(b)
}


/**
 * Execute shell command
 *
 * - resolve(): execution succeed
 * - reject(err): execution failed
 */
export function execute(command: string, options: childProcess.SpawnOptions) {
  return new Promise<void>((resolve, reject) => {
    logging(options.cwd ? `Execute: \`${command}\` at ${options.cwd}` : `Execute: \`${command}\``)

    const proc = childProcess.spawn(command, {
      shell: true,
      stdio: 'inherit',
      ...options,
    })

    proc.on('error', reject)
    proc.on('exit', code => {
      if (code !== 0) reject(new Error(`Command execute failed: ${code}`))
      else resolve()
    })
  })
}


/**
 * Detect if an object is empty
 */
export function isEmpty<O extends { [key: string]: any }>(obj?: O) {
  return !obj || Object.keys(obj).length === 0
}


/**
 * Promisify fs.readdir()
 */
function readdir(dirpath: string, withFileTypes?: false): Promise<string[]>
function readdir(dirpath: string, withFileTypes: true): Promise<fs.Dirent[]>
function readdir(dirpath: string, withFileTypes: true | false = false) {
  return new Promise<string[] | fs.Dirent[]>((resolve, reject) => {
    fs.readdir(dirpath, { withFileTypes: withFileTypes as true }, async (err, items) => {
      if (err) return reject(err)
      resolve(items)
    })
  })
}
export { readdir }
