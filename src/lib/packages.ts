/**
 * Packages management
 */
import * as path from 'path'
import * as fs from 'fs'
import logging from './logging'
import { isSamePath, readdir } from './lang'
import { Package } from './package'
import { resolveDependencies } from './dependencies'
import type { DependenciesTree } from './dependencies'


const ROOT_FILENAME = '.packages-root'      // 标记根目录的文件名


export class Packages {
  static async load(root = '') {
    if (!root) root = await findRoot()

    const map = new Map<string, Package>()
    for(const pkg of await getPackagesUnderDirectory(root)) {
      map.set(pkg.name, pkg)
    }

    return new Packages(root, map)
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
 * 将指定目录标记为 packages 根目录
 */
export async function markRoot(dirpath: string) {
  const filepath = path.join(dirpath, ROOT_FILENAME)
  fs.writeFileSync(filepath, '')
}


/**
 * 找到 packages 根目录，返回它的绝对路径
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
  return fs.existsSync(path.join(dirpath, ROOT_FILENAME))
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


/**
 * 递归找出目录及其子目录下的所有 packages
 */
async function getPackagesUnderDirectory(dirpath: string): Promise<Package[]> {
  const result: Package[] = []

  const directorys = (await readdir(dirpath, true)).filter(item => item.isDirectory())
  for(const item of directorys) {
    const itempath = path.join(dirpath, item.name)
    try {
      const pkg = await Package.getPackage(itempath)
      result.push(pkg)
    } catch {}    // 忽略不是合法 package 的项目

    if (!isIgnoreDirectory(item.name)) {
      result.push(...await getPackagesUnderDirectory(itempath))
    }
  }

  return result
}


/**
 * 符合条件的目录不检测其下的 packages
 */
function isIgnoreDirectory(name: string) {
  return name.startsWith('.') || name === 'node_modules'
}
