/**
 * Package operating
 */
import * as path from 'path'
import * as fs from 'fs'
import { fileExists, execute, isEmpty } from './lang'
import { SemVer } from './semver'
import type { PublishRecord } from './dependencies'


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
