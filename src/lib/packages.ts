/**
 * Packages management
 */
import * as path from 'path'
import * as fs from 'fs'
import logging from './logging'
import { isSamePath } from './lang'
import { Package } from './package'
import { resolveDependencies } from './dependencies'
import type { DependenciesTree } from './dependencies'


export class Packages {
  static async load(root = '') {
    if (!root) root = await findRoot()

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

        resolve(new Packages(root, map))
      })
    })
  }

  // =====================================

  public root: string

  private _packages: Map<string, Package>

  constructor(root: string, packagesMap: Map<string, Package>) {
    this.root = root
    this._packages = packagesMap
  }

  has(name: string) { return this._packages.has(name) }
  get(name: string) { return this._packages.get(name) }
  keys() { return this._packages.keys() }
  values() { return this._packages.values() }
  entries() { return this._packages.entries() }
  [Symbol.iterator]() { return this._packages.entries() }

  _dependencies: null | DependenciesTree = null
  get dependencies() {
    if (!this._dependencies) this._dependencies = resolveDependencies(this)
    return this._dependencies
  }
}


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
export function detectPackage(packages: Packages) {
  const packageDirName = path.resolve(process.cwd())
    .slice(packages.root.length + 1)
    .split(path.delimiter)[0] ?? null

  if (packageDirName) {
    const packageDir = path.join(packages.root, packageDirName)
    for(const pkg of packages.values()) {
      if (isSamePath(pkg.path, packageDir)) return pkg
    }
  }

  return null
}
