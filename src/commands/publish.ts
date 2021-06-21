import * as path from 'path'
import { Command } from 'quick-args'
import logging from '../lib/logging'
import { findRoot, getPackages, publishPackage } from '../lib/packages'
import { resolveDependencies, arrangePublishQueue } from '../lib/dependencies'
import { SemVer, isSemVerLevel } from '../lib/semver'


export default new Command({
  name: 'publish',
  describe: "publish a new version of specified package",
  handler: publishHandler
}).rest({
  name: 'packages',
  describe: 'specify packages to publish, pass package name or package directory name',
}).named({
  name: 'version',
  short: 'v',
  describe: 'specify new version or increment type: major minor patch',
})


async function publishHandler(args: { packages?: string[], version?: string }) {
  try {
    await publish(args.packages ?? [], args.version ?? '')
  } catch(e) {
    console.error(e)
  }
}


async function publish(packageNames: string[], versionKeyword: string) {
  const root = await findRoot()
  const packages = await getPackages(root)
  const dependencies = resolveDependencies(packages)

  // 解析版本更新参数
  const versionUpdates = isSemVerLevel(versionKeyword)
    ? versionKeyword
    : SemVer.parse(versionKeyword)
  if (!versionUpdates) throw new Error(`Invalid version keyword ${versionKeyword}`)

  // 确认要发新版的 package
  function confirmPublishPackage(packageName: string) {
    if (packages.has(packageName)) {
      return packages.get(packageName)!
    } else {
      const packagePath = path.join(root, packageName)
      const detectedPkg = [...packages.values()].find(p => p.path === packagePath)
      if (detectedPkg) return detectedPkg
      else throw new Error(`Package ${packageName} not exists`)
    }
  }
  const entryPackages = packageNames.map(confirmPublishPackage)

  // 生成所有需要更新的相关包的更新队列，依次发布新版
  const queue = arrangePublishQueue(
    new Map(entryPackages.map(pkg => [pkg.name, versionUpdates])),
    packages,
    dependencies
  )
  for(const [packageName, record] of queue.entries()) {
    const pkg = packages.get(packageName)!
    pkg.version = record.newVersion
    for(const depRecord of record.dependencies.values()) {
      pkg.dependencies.set(depRecord.name, depRecord.newVersion)
    }
  }

  logging(`\nUpdates:\n${[...queue.values()].map(r =>
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
