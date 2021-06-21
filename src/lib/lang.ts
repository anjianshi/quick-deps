import * as fs from 'fs'
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
