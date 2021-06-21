/**
 * package management functions
 */
import * as path from 'path'
import * as fs from 'fs'
import logging from './logging'
import { fileExists, isSamePath, execute } from './lang'
import { SemVer } from './semver'


// ==============================
// Packages Root
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

  // version 无法成功解析成 SemVer 的 package 会被忽略
  version: SemVer,

  /*
  原 dependencies、devDependencies、peerDependencies 合并到一起以便于处理
  不影响最终写入到 package.json 里的内容；只是就不支持同一个依赖项在这三个种类里有不同的版本号了，不过因为设计上也要求版本号固定用最新的，所以没关系

  依赖版本无法解析成 SemVer 的依赖会被忽略
  */
  dependencies: Map<string, SemVer>

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
  const formatted = formatInfoFromPackageJSON(raw, rawString, dirpath)
  if (!formatted) throw new Error('package format failed')
  return formatted
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
function formatInfoFromPackageJSON(raw: InfoFromPackageJSON, rawString: string, dirpath: string): Package | null {
  const version = SemVer.parse(raw.version ?? '')
  if (!version) return null

  const dependencies: Package['dependencies'] = new Map()
  const rawDependencies = [
    ...Object.entries(raw.dependencies ?? {}),
    ...Object.entries(raw.devDependencies ?? {}),
    ...Object.entries(raw.peerDependencies ?? {})
  ]
  for(const [depName, devRawVersion] of rawDependencies) {
    const depVersion = SemVer.parse(devRawVersion)
    if (!depVersion) continue

    // 同依赖已出现过，记录版本号较大的那个
    if (!dependencies.has(depName) || depVersion.diff(dependencies.get(depName)!).diff === 1) {
      dependencies.set(depName, depVersion)
    }
  }

  const fallbackName = path.basename(dirpath)

  return {
    name: (raw.name ?? '') || fallbackName,
    version: version,
    dependencies,
    raw,
    rawString,
    path: dirpath,
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
    updated.version = pkg.version.toString()

    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (isEmpty(updated[depType])) continue
      const source = updated[depType] as { [name: string]: string }
      for(const [depName, depVersion] of pkg.dependencies) {
        source[depName] = depVersion.toString()
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
  return !obj || Object.keys(obj).length === 0
}


/**
 * 对指定 package 执行 publish 操作
 */
export async function publishPackage(pkg: Package, shouldSyncDependencies = true) {
  await writePackage(pkg)

  try {
    if (shouldSyncDependencies) await syncDependencies(pkg)
    await execute('npm publish', { cwd: pkg.path })
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
    await execute('yarn --version', { cwd: pkg.path })
  } catch(e) {
    hasYarnBin = false
  }
  const useYarn = hasYarnBin && (
    await fileExists(path.join(pkg.path, 'yarn.lock'))
    || ! await fileExists(path.join(pkg.path, 'package-lock.json'))
  )

  const command = useYarn ? 'yarn' : 'npm install'
  await execute(command, { cwd: pkg.path })
}
