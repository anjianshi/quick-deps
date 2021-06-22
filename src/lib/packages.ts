/**
 * package management functions
 */
import * as path from 'path'
import * as fs from 'fs'
import logging from './logging'
import { fileExists, isSamePath, execute, isEmpty } from './lang'
import { SemVer } from './semver'
import type { PublishRecord } from './dependencies'


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
            await Package.getPackage(subpath)  // 能成功读到 package.json 不报错，说明这子目录是一个合法 package
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
          const pkg = await Package.getPackage(dirpath)
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


export class Package {
  /**
   * 生成指定路径的包的 Package 对象
   */
  static async getPackage(dirpath: string) {
    const [raw, rawString] = await Package.getInfoFromPackageJSON(dirpath)
    const { name, version, dependencies } = Package.formatInfoFromPackageJSON(raw, dirpath)
    return new Package(name, version, dependencies, raw, rawString, dirpath)
  }

  /**
  * 获取指定 package 的 package.json 内容
  * 若指定目录不是一个合法 package，抛出异常
  */
  private static getInfoFromPackageJSON(dirpath: string) {
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
  private static formatInfoFromPackageJSON(raw: InfoFromPackageJSON, dirpath: string): Pick<Package, 'name' | 'version' | 'dependencies'> {
    const version = SemVer.parse(raw.version ?? '')
    if (!version) throw new Error(`package '${raw.name}' parse failed: invalid version '${raw.version}'`)

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
    const name = (raw.name ?? '') || fallbackName

    return { name, version, dependencies }
  }

  // =========================================================

  constructor(
    public name: string,
    public version: SemVer,

    // 原 dependencies、devDependencies、peerDependencies 合并到一起以便于处理
    // 不影响最终写入到 package.json 里的内容；只是就不支持同一个依赖项在这三个种类里有不同的版本号了，不过因为设计上也要求版本号固定用最新的，所以没关系
    public dependencies: Map<string, SemVer>,

    // 最原始的完整 package.json 数据，在 Package 对象的整个生命周期中不会改变
    public raw: InfoFromPackageJSON & { [key: string]: any },
    public rawString: string,

    // 此包所在路径
    public path: string
  ) {}

  /**
   * 将更新过的字段值写入 package.json（不会改变 raw、rawString，因为根据情况还可能需要把原内容还原回来）
   */
  writeUpdated() {
    const updated = { ...this.raw }
    updated.name = this.name
    updated.version = this.version.toString()

    for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (isEmpty(updated[depType])) continue
      const source = updated[depType] as { [name: string]: string }
      for(const depName of Object.keys(source)) {
        if (this.dependencies.has(depName)) source[depName] = this.dependencies.get(depName)!.toString()
      }
    }

    const endString = this.rawString.slice(this.rawString.lastIndexOf('}') + 1)
    const json = JSON.stringify(updated, null, 2) + endString

    return this.write(json)
  }

  /**
   * 将原始的 package.json 内容更新回 package.json 文件
   * （仅还原 package.json 文件内容，此对象修改过的字段值并不会被还原）
   */
  restorePackageJSON() {
    this.write(this.rawString)
  }

  /**
   * 将指定内容写入此 package 的 package.json
   */
   private write(json: string) {
    return new Promise<void>((resolve, reject) => {
      const jsonpath = path.join(this.path, 'package.json')
      fs.writeFile(jsonpath, json, err => {
        if (err) return reject(new Error(`update "${jsonpath}" failed：${err}`))
        resolve()
      })
    })
  }

  /**
   * 此包发布新版
   * - 支持传入 arrangePublishQueue() 生成的发布信息，会基于它先更新包数据再发布
   * - 因为发布、打包一般需要先安装依赖，所以 shouldSyncDependencies 默认为 true
   */
  async publish(updates?: PublishRecord, shouldSyncDependencies = true) {
    if (updates) {
      this.version = updates.newVersion
      for(const depRecord of updates.dependencies.values()) {
        this.dependencies.set(depRecord.name, depRecord.newVersion)
      }
    }

    await this.writeUpdated()     // 将此包更新过的内容（版本号、依赖版本）写入 package.json

    try {
      if (shouldSyncDependencies) await this.syncDependencies()
      await execute('npm publish', { cwd: this.path })
    } catch(e) {
      // 发布失败，还原 package.json 内容
      await this.restorePackageJSON()
      throw e
    }
  }

  /**
   * 安装此包的依赖项
   */
  protected async syncDependencies() {
    let hasYarnBin = true
    try {
      await execute('yarn --version', { cwd: this.path })
    } catch(e) {
      hasYarnBin = false
    }
    const useYarn = hasYarnBin && (
      await fileExists(path.join(this.path, 'yarn.lock'))
      || ! await fileExists(path.join(this.path, 'package-lock.json'))
    )

    const command = useYarn ? 'yarn' : 'npm install'
    await execute(command, { cwd: this.path })
  }
}
