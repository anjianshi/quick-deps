import * as path from 'path'
import { Command } from 'quick-args'
import logging from '../lib/logging'
import { findRoot, getPackages, detectPackage, publishPackage } from '../lib/packages'
import type { Package } from '../lib/packages'
import { resolveDependencies, arrangePublishQueue } from '../lib/analytics'


export default new Command({
  name: 'publish',
  describe: "publish a new version of specified package",
  handler: publishHandler
}).named({
  name: 'package',
  short: 'p',
  describe: 'specify package to publish, pass package name or package directory name',
}).named({
  name: 'version',
  short: 'v',
  describe: 'specify new version or increment type: major minor patch',
})


async function publishHandler(args: { package?: string, version?: string }) {
  try {
    await publish(args.package ?? '', args.version ?? '')
  } catch(e) {
    console.error(e)
  }
}


async function publish(packageName: string, versionKeyword: string) {
  const root = await findRoot()
  const packages = await getPackages(root)
  const dependencies = resolveDependencies(packages)

  // 确认要发新版的 package
  let pkg: Package
  if (packageName) {
    if (packages.has(packageName)) {
      pkg = packages.get(packageName)!
    } else {
      const packagePath = path.join(root, packageName)
      const detectedPkg = [...packages.values()].find(p => p.path === packagePath)
      if (detectedPkg) pkg = detectedPkg
      else throw new Error(`package ${packageName} not exists`)
    }
  } else {
    const detected = detectPackage(root, packages)
    if (!detected) throw new Error(`Not in package directory, need specify package name`)
    pkg = detected
  }

  // 生成所有需要更新的相关包的更新队列，依次发布新版
  const updates: PublishUpdateRecord[] = []
  const queue = arrangePublishQueue(pkg, versionKeyword, packages, dependencies)
  for(const [packageName, newVersion] of queue.entries()) {
    const pkg = packages.get(packageName)!
    const prevVersion = pkg.version
    pkg.version = newVersion

    // 此包的依赖可能也在此次更新队列里，版本号也变化了，那么在此也要更新依赖的版本号
    const updatedDependencies: PublishDependenciesUpdateRecord[] = []
    for(const dep of pkg.dependencies.keys()) {
      if (queue.has(dep)) {
        const depNewVersion = queue.get(dep)!
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

  logging(`\nUpdates:\n${updates.map(u =>
    `${u.name}: ${u.prevVersion} => ${u.newVersion}${u.dependencies.length
      ? '\n' + u.dependencies.map(d =>
        `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`
      ).join('\n')
      : ''}`
  ).join('\n\n')}\n`)

  for(const updatePackageName of queue.keys()) {
    await publishPackage(packages.get(updatePackageName)!, updatePackageName !== pkg.name)
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
