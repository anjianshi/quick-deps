import * as path from 'path'
import { Command } from 'quick-args'
import logging from '../lib/logging'
import { findRoot, getPackages, publishPackage } from '../lib/packages'
import { resolveDependencies, arrangePublishQueue } from '../lib/dependencies'
import { SemVer, isSemVerLevel } from '../lib/semver'
import type { SemVerLevel } from '../lib/semver'


export default new Command({
  name: 'sync',
  describe: "Keep packages depends newest version from each other.",
  handler: syncHandler,
})


async function syncHandler() {
  try {
    await executeSync()
  } catch(e) {
    console.error(e)
  }
}


async function executeSync() {
  const root = await findRoot()
  const packages = await getPackages(root)
  const dependencies = resolveDependencies(packages)

  // 找出依赖过时的包
  const entries = new Map<string, SemVerLevel>()
  for (const pkg of packages.values()) {
    for(const [dep, depVersion] of pkg.dependencies.entries()) {
      const depPackage = packages.get(dep)
      if (!depPackage) continue

      const versionDiff = depVersion.diff(depPackage.version)
      if (versionDiff.diff === -1) entries.set(pkg.name, versionDiff.level)
    }
  }

  // 生成所有需要更新的相关包的更新队列，依次发布新版
  const queue = arrangePublishQueue(entries, packages, dependencies)
  for(const [packageName, record] of queue.entries()) {
    const pkg = packages.get(packageName)!
    pkg.version = record.newVersion
    for(const depRecord of record.dependencies.values()) {
      pkg.dependencies.set(depRecord.name, depRecord.newVersion)
    }
  }

  logging(`\nSync:\n${[...queue.values()].map(r =>
    `${r.name}: ${r.prevVersion} => ${r.newVersion}${r.dependencies.length
      ? '\n' + r.dependencies.map(d =>
        `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`
      ).join('\n')
      : ''}`
  ).join('\n\n')}\n\n`)

  for(const updatePackageName of queue.keys()) {
    await publishPackage(packages.get(updatePackageName)!)
  }
}
interface PublishUpdateRecord {
  name: string,                                      // 更新了的包名
  prevVersion: string,                               // 更新前的版本号
  newVersion: string,                                // 更新后的版本号
  dependencies: PublishDependenciesUpdateRecord[]    // 此包发生了更新的依赖包名和版本号
}
interface PublishDependenciesUpdateRecord {
  name: string,
  prevVersion: string,
  newVersion: string,
}
