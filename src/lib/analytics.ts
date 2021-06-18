/**
 * 实现对包依赖关系等的分析
 */
import type { Packages, Package } from './packages'


export type SemVerKeyword = 'major' | 'minor' | 'patch'


export type DependenciesTree = Map<string, DependenciesLeaf>

// 通过 dependencies、usedBy 两个链表可实现正向和反向索引依赖关系
interface DependenciesLeaf {
  name: string,

  dependencies: DependenciesTree,     // 此 package 的直接依赖项
  usedBy: DependenciesTree,           // 直接依赖此 package 的项目
}


/**
 * 分析给定各包间的依赖关系
 */
export function resolveDependencies(packages: Packages): DependenciesTree {
  const root: DependenciesTree = new Map()

  function initTree(name: string) {
    if (!packages.has(name)) return null    // 只处理包列表里有的依赖项
    if (!root.has(name)) {
      root.set(name, {
        name,
        dependencies: new Map(),
        usedBy: new Map(),
      })
    }
    return root.get(name)!
  }

  // 初始化 packages tree，填充依赖项
  for(const pkg of packages.values()) {
    // 初始化此包的依赖树（若已经被前面的包初始化过了，会跳过初始化）
    const pkgTree = initTree(pkg.name)!
    for(const dep of pkg.dependencies.keys()) {
      // 若涉及的依赖还没初始化过依赖树，这里执行以下初始化（不然没有节点可以引用）
      const depTree = initTree(dep)
      if (depTree) {
        pkgTree.dependencies.set(dep, depTree)
        depTree.usedBy.set(pkg.name, pkgTree)
      }
    }
  }

  // 清理没有任何依赖关系的 package
  for(const [name, tree] of root) {
    if (tree.dependencies.size === 0 && tree.usedBy.size === 0) root.delete(name)
  }

  const circularNodes = detectCircularDependency(root)
  if (circularNodes) throw new Error(`发现循环依赖：${circularNodes.join(' -> ')}`)

  return root
}


/**
 * 检查依赖列表里是否有循环依赖
 * 如果有，返回循环的节点列表
 */
function detectCircularDependency(tree: DependenciesTree) {
  return _detectCircularDependency(tree, new Set())
}
function _detectCircularDependency(tree: DependenciesTree, prevLeaves: Set<DependenciesLeaf>): null | string[] {
  // 检查当前 tree 的 leaf 有没有出现循环依赖
  for(const leaf of tree.values()) {
    if (prevLeaves.has(leaf)) return [...prevLeaves.values(), leaf].map(v => v.name)
  }

  // 检查各 leaf 的子 tree 有没有出现循环依赖
  for(const leaf of tree.values()) {
    const detected = _detectCircularDependency(leaf.dependencies, new Set([...prevLeaves, leaf]))
    if (detected) return detected
  }

  return null
}


/**
 * 按 sermver 格式解析 package 版本号
 */
export function parseVersion(version: string) {
  const [rawMajor, rawMinor = '0', rawPatch = '0'] = version.split('.', 3)
  let [major, minor, patch] = [rawMajor, rawMinor, rawPatch].map(toNumber)
  return { major, minor, patch }
}


/**
 * 判断两个版本号是否有差别
 *
 * 版本号相同：             { diff: 0 }
 * ver1 版本高于 ver2：     { diff: 1, keyword }
 * ver1 版本低于 ver2：     { diff: -1, keyword }
 */
 export function diffVersion(ver1Str: string, ver2Str: string): { diff: 0 } | { diff: 1 | -1, keyword: SemVerKeyword } {
   const ver1 = parseVersion(ver1Str)
   const ver2 = parseVersion(ver2Str)
   for(const keyword of ['major', 'minor', 'patch'] as SemVerKeyword[]) {
     if (ver1[keyword] > ver2[keyword]) return { diff: 1, keyword }
     else if (ver1[keyword] < ver2[keyword]) return { diff: -1, keyword }
   }
   return { diff: 0 }
 }


/**
 * 为 package 生成新的版本号
 *
 * keyword:
 * - 传入 major、minor、patch 按照指定规则更新（详见 semver 介绍：https://semver.org/）
 * - 传入空字符串则不更新
 * - 传入其他值则直接用这个值作为新版本号
 */
export function updateVersion(current: string, keyword: string) {
  let { major, minor, patch } = parseVersion(current)

  if (keyword === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (keyword === 'minor') {
    minor += 1
    patch = 0
  }
  else if (keyword === 'patch') {
    patch += 1
  } else {
    return keyword || current
  }

  return `${major}.${minor}.${patch}`
}

function toNumber(str: string) {
  const parsed = parseInt(str, 10)
  return isFinite(parsed) ? parsed : 0
}

/**
 * 列出为了更新指定 package 后需要跟着更新的所有包的列表；并根据依赖关系排序，需要先更新的排前面
 * （初始要更新的包也会包含在列表里；且初始包需要提前设置好更新后的版本号）
 *
 * 返回： Map<packageName, newVersion>
 */
const semVerMap = { major: 2, minor: 1, patch: 0 }
interface PublishRecord {
  name: string,     // 包名
  weights: number,  // 权重（数字越大越晚发布）
  version: string,  // 新发布要使用的版本号
}
export function arrangePublishQueue(
  entry: Package,
  entryVersionKeyword: string,      // 这个参数直接传给 updateVersion()，允许不是 semVerKeyword
  packages: Packages,
  dependencies: DependenciesTree
) {
  // 需要更新的所有包的名称
  const packages2publish = new Set<string>()
  function expandRelated(packageName: string) {
    if (!packages.has(packageName)) return
    if (packages2publish.has(packageName)) return

    // 当前包加入相关包列表
    packages2publish.add(packageName)

    // 依赖此包的包加入相关包列表
    const packageUsedBy = dependencies.get(packageName)?.usedBy
    if (packageUsedBy) {
      for(const usedByPackage of packageUsedBy.keys()) expandRelated(usedByPackage)
    }
  }
  expandRelated(entry.name)

  // 计算各包的更新顺序及版本号
  // 出现在此 Map 里的都是已计算完成的包
  // packageName => PublishRecord
  const records = new Map<string, PublishRecord>()
  function compute(packageName: string) {
    if (records.has(packageName)) return
    const pkg = packages.get(packageName)!

    const dependenciesWillPublish = [...dependencies.get(packageName)?.dependencies.keys() ?? []]
      .filter(name => packages2publish.has(name))

    let weights = 1
    let semVerLevel: SemVerKeyword = 'patch'
    dependenciesWillPublish.forEach(dependencyPackageName => {
      if (!records.has(dependencyPackageName)) compute(dependencyPackageName)
      const dependencyRecord = records.get(dependencyPackageName)!
      weights += dependencyRecord.weights

      const dependencyVersion = pkg.dependencies.get(dependencyPackageName)!
      const diff = diffVersion(dependencyRecord.version, dependencyVersion)
      if (diff.diff === 1 && semVerMap[diff.keyword] > semVerMap[semVerLevel]) semVerLevel = diff.keyword
    })
    const newVersion = updateVersion(
      pkg.version,
      pkg.name == entry.name ? entryVersionKeyword : semVerLevel   // entry 包的 semVerLevel 通过外接传入，不通过计算获得
    )

    records.set(packageName, { name: packageName, weights, version: newVersion })
  }
  packages2publish.forEach(compute)

  // 按更新顺序对包列表进行排序
  const sorted = [...records.values()].sort((a, b) => a.weights - b.weights)

  return new Map(sorted.map(r => [r.name, r.version]))
}
