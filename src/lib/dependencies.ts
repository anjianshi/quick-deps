/**
 * Analytics packages, eg. package dependency relationship
 */
import type { Packages } from './packages'
import type { SemVerLevel } from './semver'
import { SemVer } from './semver'


/**
 * Generate package dependency relationship tree
 */
export type DependenciesTree = Map<string, DependenciesLeaf>

// The two trees `dependencies` and `usedBy` that have inverse direction,
// was used to quickly traverse dependencies in any direction.
interface DependenciesLeaf {
  name: string,                       // package name
  dependencies: DependenciesTree,     // packages directly depended by this package（此 package 的直接依赖项）
  usedBy: DependenciesTree,           // packages directly depends this package（直接依赖此 package 的项目）
}

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
 * 基于初始要更新的包列表，生成完整的待更新包队列（需要先更新的排在队列前面）
 * (一个包更新后，依赖它的包也要跟着更新，且这些包发布要有先后顺序，因此需要这样一个计算函数)
 */
export function arrangePublishQueue(
  entries: Map<string, SemVer | SemVerLevel>,     // 初始要更新的包 Map(packageName => new version or version updates)
  packages: Packages,
) {
  const packages2publish = expandRelateds([...entries.keys()], packages)
  return computePublishQueue(packages2publish, entries, packages)
}


/**
 * 返回与指定包有关联（依赖或间接依赖）的所有包
 */
type RelatedRecord = Set<string | null>
type RelatedRecords = Map<string, RelatedRecord>   // packageName => 经由哪些包被加入到相关列表里，entry 包这里会有一项 null

function expandRelateds(entryPackageNames: string[], packages: Packages) {
  const relateds: RelatedRecords = new Map()

  function expand(packageName: string, fromPackage: string | null) {
    if (!packages.has(packageName)) return

    if (!relateds.has(packageName)) {
      // 此包加入相关包列表
      relateds.set(packageName, new Set([fromPackage]))

      // 依赖此包的包加入相关包列表
      const packageUsedBy = packages.dependencies.get(packageName)?.usedBy
      for(const usedByPackage of packageUsedBy?.keys() ?? []) expand(usedByPackage, packageName)
    } else {
      // 此包已加入过列表，则只更新一下引用记录
      relateds.get(packageName)!.add(fromPackage)
    }
  }

  entryPackageNames.forEach(name => expand(name, null))
  return relateds
}


/**
 * 计算待发布各包的发布顺序和发布版本号
 */
const semVerMap = { major: 2, minor: 1, patch: 0 }

interface PublishComputeResult {
  name: string,     // 包名
  weights: number,  // 权重（数字越大越晚发布）
  version: SemVer,  // 新发布要使用的版本号
}

export interface PublishRecord {
  name: string,                                      // 更新了的包名
  prevVersion: SemVer,                               // 更新前的版本号
  newVersion: SemVer,                                // 更新后的版本号
  dependencies: PublishDependenciesRecord[]          // 此包发生了更新的依赖包名和版本号
  addedBy: RelatedRecord                             // 因哪些包发生了变更导致此包要发布，entry 包此项为空
}

export interface PublishDependenciesRecord {
  name: string,
  prevVersion: SemVer,
  newVersion: SemVer,
}

function computePublishQueue(
  packages2publish: RelatedRecords,
  entries: Map<string, SemVer | SemVerLevel>,
  packages: Packages,
): Map<string, PublishRecord> {
  const computed = new Map<string, PublishComputeResult>()
  function compute(packageName: string) {
    if (computed.has(packageName)) return
    const pkg = packages.get(packageName)!

    const dependenciesWillPublish = [...packages.dependencies.get(packageName)?.dependencies.keys() ?? []]
      .filter(name => packages2publish.has(name))

    let weights = 1
    let semVerLevel: SemVerLevel = 'patch'
    dependenciesWillPublish.forEach(dependencyPackageName => {
      if (!computed.has(dependencyPackageName)) compute(dependencyPackageName)
      const dependencyRecord = computed.get(dependencyPackageName)!
      weights += dependencyRecord.weights

      const dependencyVersion = pkg.dependencies.get(dependencyPackageName)!
      const diff = dependencyRecord.version.diff(dependencyVersion)
      if (diff.diff === 1 && semVerMap[diff.level] > semVerMap[semVerLevel]) semVerLevel = diff.level
    })
    const newVersion = pkg.version.update(
      entries.has(pkg.name) ? entries.get(pkg.name)! : semVerLevel   // entry 包的 semVerLevel 通过外界传入，不通过计算获得
    )

    computed.set(packageName, { name: packageName, weights, version: newVersion })
  }
  [...packages2publish.keys()].forEach(compute)

  // 按更新顺序对包列表进行排序
  const sorted = new Map(
    [...computed.values()].sort((a, b) => a.weights - b.weights)
      .map(r => [r.name, r])
  )

  // 生成最终的队列
  return new Map(
    [...sorted.values()].map(({ name: packageName, version: newVersion }) => {
      const pkg = packages.get(packageName)!
      const prevVersion = pkg.version

      const depRecords: PublishDependenciesRecord[]  = []
      for(const [depName, depPrevVersion] of pkg.dependencies) {
        const depNewVersion = sorted.get(depName)?.version
        if (!depNewVersion) continue
        depRecords.push({ name: depName, prevVersion: depPrevVersion, newVersion: depNewVersion })
      }

      return [
        packageName,
        {
          name: packageName,
          prevVersion,
          newVersion,
          dependencies: depRecords,
          addedBy: packages2publish.get(packageName)!
        }
      ]
    })
  )
}
