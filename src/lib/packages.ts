/**
 * package 信息相关工具函数
 */
import * as path from 'path'
import * as fs from 'fs'
import * as childProcess from 'child_process'
import logging from './logging'
import { diffVersion } from './analytics'


// ==============================
// Root
// ==============================

/**
 * 找到 packages 根目录
 *
 * 规则：
 * - 如果 `当前目录` 下有任意 `子目录` 直接包含一个 `package.json` 文件，则认为 `当前目录` 是 `根目录`。
 * - 否则递归向上查找，直到找到最上层。
 * - 如果最终还是没找到，依然把当前目录视为 `根目录`，但是因为当前目录下没有符合要求的 package，所以是空的，不会触发任何行为。
 *
 * 返回 packages 根目录的绝对路径
 */
 export async function findRoot() {
  const initial = path.resolve(process.cwd())

  let checking = initial
  while(true) {
    // 找到 packages 根目录
    const result = await detectIsRoot(checking)
    logging(`detecting root "${checking}": ${result ? 'true' : 'false'}`)
    if (result) return checking

    // 向上递归
    const parent = path.dirname(checking)
    if (parent === checking) {
      logging(`use current path as root: ${initial}`)
      return initial // 如果已经没有上级目录了，返回初始目录
    }
    checking = parent
  }
}


/**
 * 判断一个目录是否是 packages 根目录
 */
function detectIsRoot(dirpath: string) {
  return new Promise(resolve => {
    // 遍历目录下的内容，若能一个合法的 package，便视为是一个 packages 根目录
    fs.readdir(dirpath, { withFileTypes: true }, async (err, files) => {
      // 目录内容读取失败
      if (err) return resolve(false)

      // 遍历各子目录，看能否找到一个合法 package
      for(const item of files) {
        if (item.isDirectory()) {
          const subpath = path.join(dirpath, item.name)
          try {
            await getPackage(subpath)  // 能成功读到 package.json 不报错，说明这子目录是一个合法 package
            return resolve(true)
          } catch {}
        }
      }

      // 指定目录下没有找到合法 package
      resolve(false)
    })
  })
}


/**
 * 确认当前是否在某一个 package 文件夹中，如果是，返回 package name
 */
export function detectPackage(root: string, packages: Packages) {
  const packageDirName = path.resolve(process.cwd())
    .slice(root.length + 1)
    .split(path.delimiter)[0] ?? null

  if (packageDirName) {
    const packageDir = path.join(root, packageDirName)
    for(const pkg of packages.values()) {
      if (isSamePath(pkg.path, packageDir)) return pkg
    }
  }

  return null
}



/**
 * 判断两个路径是否相同
 */
function isSamePath(a: string, b: string) {
  return path.resolve(a) === path.resolve(b)
}


// ==============================
// Packages
// ==============================


export type Packages = Map<string, Package>


/**
 * 获取根目录下各 package 的 package.json 内容
 */
export function getPackages(root: string) {
  return new Promise<Packages>((resolve, reject) => {
    fs.readdir(root, async (err, items) => {
      if (err) return reject(err)

      const map = new Map<string, Package>()
      for(const item of items) {
        const dirpath = path.join(root, item)
        try {
          const pkg = await getPackage(dirpath)
          map.set(pkg.name, pkg)
        } catch {}    // 忽略不是合法 package 的项目
      }
      resolve(map)
    })
  })
}



// ==============================
// Package
// ==============================

// package.json 里取得的信息
interface InfoFromPackageJSON {
  name?: string,
  version?: string,
  dependencies?: { [name: string]: string },
  devDependencies?: { [name: string]: string },
  peerDependencies?: { [name: string]: string },
}


// 整理过的 package 信息
export interface Package {
  name: string,
  version: string,

  // 原 dependencies、devDependencies、peerDependencies 合并到一起以便于处理
  // （不影响最终写入到 package.json 里的内容；只是就不支持同一个依赖项在这三个种类里有不同的版本号了，不过因为设计上也要求版本号固定用最新的，所以没关系）
  dependencies: Map<string, string>   // name => version

  // 原始的完整 package.json 数据
  raw: InfoFromPackageJSON & { [key: string]: any },
  rawString: string,

  // 此包所在路径
  path: string,
}


/**
 * 获取指定 package 的信息
 * 若指定目录不是一个合法 package，抛出对应异常
 */
 export async function getPackage(dirpath: string) {
  const [raw, rawString] = await getInfoFromPackageJSON(dirpath)
  return formatInfoFromPackageJSON(raw, rawString, dirpath)
}


/**
 * 获取指定 package 的 package.json 内容
 * 若指定目录不是一个合法 package，抛出对应异常
 */
function getInfoFromPackageJSON(dirpath: string) {
  return new Promise<[InfoFromPackageJSON, string]>((resolve, reject) => {
    const jsonpath = path.join(dirpath, 'package.json')
    fs.readFile(jsonpath, (err, text) => {
      if (err) return reject(new Error(`'${dirpath}' is not a valid pacakge，read package.json failed：${err}`))
      try {
        const string = text.toString()
        const raw = JSON.parse(string)
        resolve([raw, string])
      } catch(e) {
        reject(new Error(`'${dirpath}' package.json invalid：${err}`))
      }
    })
  })
}


/**
 * 格式化从 package.json 里取得的包信息
 */
function formatInfoFromPackageJSON(raw: InfoFromPackageJSON, rawString: string, dirpath: string): Package {
  const fallbackName = path.basename(dirpath)

  const dependencies: Package['dependencies'] = new Map()
  const rawDependencies = [...Object.entries(raw.dependencies ?? {}), ...Object.entries(raw.devDependencies ?? {}), ...Object.entries(raw.peerDependencies ?? {})]
  for(const [name, version] of rawDependencies) {
    // 同一个依赖出现两次，取版本号最大的
    if (dependencies.has(name)) {
      if (diffVersion(version, dependencies.get(name)!).diff === 1) dependencies.set(name, version)
    } else {
      dependencies.set(name, version)
    }
  }

  return {
    raw,
    rawString,
    path: dirpath,
    name: (raw.name ?? '') || fallbackName,
    version: (raw.version ?? '') || '0.0.1',
    dependencies,
  }
}


/**
 * 将包信息写入到指定 package 的 package.json 里
 */
export function writePackage(pkg: Package, writeRaw = false) {
  let json: string
  if (writeRaw) {
    json = pkg.rawString
  } else {
    const updated = { ...pkg.raw }
    updated.name = pkg.name
    updated.version = pkg.version

    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (isEmpty(updated[depType])) continue
      const source = updated[depType]
      for(const [depName, devVersion] of Object.entries(source)) {
        const newVersion = pkg.dependencies.get(depName)
        if (devVersion !== newVersion) source[depName] = newVersion
      }
    }

    json = JSON.stringify(updated, null, 2)

    const endString = pkg.rawString.slice(pkg.rawString.lastIndexOf('}') + 1)
    json += endString
  }

  return new Promise<void>((resolve, reject) => {
    const jsonpath = path.join(pkg.path, 'package.json')
    fs.writeFile(jsonpath, json, err => {
      if (err) return reject(new Error(`update "${jsonpath}" failed：${err}`))
      resolve()
    })
  })
}

function isEmpty<O extends { [key: string]: any }>(obj?: O) {
  return !obj || Object.keys(obj).length > 0
}


/**
 * 对指定 package 执行 publish 操作
 */
export async function publishPackage(pkg: Package, shouldSyncDependencies = false) {
  await writePackage(pkg)

  try {
    if (shouldSyncDependencies) await syncDependencies(pkg)
    await execute('npm publish', pkg.path)
  } catch(e) {
    // 发布失败，还原 package.json 内容
    await writePackage(pkg, true)

    throw e
  }
}


/**
 * 安装指定包的依赖
 */
async function syncDependencies(pkg: Package) {
  let hasYarnBin = true
  try {
    await execute('yarn --version', pkg.path)
  } catch(e) {
    hasYarnBin = false
  }
  const useYarn = hasYarnBin && (
    await fileExists(path.join(pkg.path, 'yarn.lock'))
    || ! await fileExists(path.join(pkg.path, 'package-lock.json'))
  )

  if (useYarn) await execute('yarn', pkg.path)
  else await execute('npm install', pkg.path)
}


function execute(command: string, cwd?: string, stdio: childProcess.StdioOptions='inherit') {
  return new Promise<void>((resolve, reject) => {
    logging(cwd ? `Execute: \`${command}\` at ${cwd}` : `Execute: \`${command}\``)

    const proc = childProcess.spawn(command, {
      ... cwd ? { cwd } : {},
      shell: true,
      stdio,
    })

    proc.on('error', reject)
    proc.on('exit', code => {
      if (code !== 0) reject(new Error(`Command execute failed: ${code}`))
      else resolve()
    })
  })
}


function fileExists(filepath: string) {
  return new Promise<boolean>(resolve => {
    fs.stat(filepath, (err, stat) => {
      resolve(stat && stat.isFile())
    })
  })
}
