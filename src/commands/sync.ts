import * as path from 'path'
import { Command } from 'quick-args'
import logging from '../lib/logging'
import { findRoot, getPackages, publishPackage } from '../lib/packages'
import { resolveDependencies, arrangePublishQueue, diffVersion, parseVersion } from '../lib/analytics'


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
  const entries = new Map<string, string>()
  for (const pkg of packages.values()) {
    for(const [dep, depVersion] of pkg.dependencies.entries()) {
      const depPackage = packages.get(dep)
      if (!depPackage) continue

      const versionDiff = diffVersion(depVersion, depPackage.version)
      if (versionDiff.diff === -1) {
        entries.set(pkg.name, versionDiff.keyword)
      }
    }
  }

  // 生成所有需要更新的相关包的更新队列，依次发布新版
  const updates: PublishUpdateRecord[] = []
  const queue = arrangePublishQueue(entries, packages, dependencies)
  for(const [packageName, newVersion] of queue.entries()) {
    const pkg = packages.get(packageName)!
    const prevVersion = pkg.version
    pkg.version = newVersion

    // 此包的依赖可能也在此次更新队列里，版本号也变化了，那么在此也要更新依赖的版本号
    const updatedDependencies: PublishDependenciesUpdateRecord[] = []
    for(const [dep, depVersion] of pkg.dependencies) {
      if (queue.has(dep)) {
        const depNewVersion =  parseVersion(depVersion).prefix + queue.get(dep)!
        pkg.dependencies.set(dep, depNewVersion)
        updatedDependencies.push({ name: dep, prevVersion: pkg.dependencies.get(dep)!, newVersion: depNewVersion })
      }
    }

    updates.push({
      name: packageName,
      prevVersion,
      newVersion,
      dependencies: updatedDependencies
    })
  }

  logging(`\nSync:\n${updates.map(u =>
    `${u.name}: ${u.prevVersion} => ${u.newVersion}${u.dependencies.length
      ? '\n' + u.dependencies.map(d =>
        `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`
      ).join('\n')
      : ''}`
  ).join('\n\n')}\n`)

  for(const updatePackageName of queue.keys()) {
    await publishPackage(packages.get(updatePackageName)!, true)
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
