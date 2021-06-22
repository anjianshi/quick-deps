import { Command } from 'quick-args'
import logging from '../lib/logging'
import { Packages } from '../lib/packages'
import { arrangePublishQueue } from '../lib/dependencies'
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
  const packages = await Packages.load()

  // 找出依赖过时的包
  const entries = new Map<string, SemVerLevel>()
  const entriesAddedBy = new Map<string, string>()
  for (const pkg of packages.values()) {
    for(const [dep, depVersion] of pkg.dependencies.entries()) {
      const depPackage = packages.get(dep)
      if (!depPackage) continue

      const versionDiff = depVersion.diff(depPackage.version)
      if (versionDiff.diff === -1) {
        entries.set(pkg.name, versionDiff.level)
        entriesAddedBy.set(pkg.name, dep)
        pkg.dependencies.set(dep, depPackage.version.withPrefix(depVersion.prefix))
      }
    }
  }

  // 生成所有需要更新的相关包的更新队列，依次发布新版
  const queue = arrangePublishQueue(entries, packages)

  if (!queue.size) {
    logging('Everything is OK.')
  } else {
    logging(`\nSync:\n${[...queue.values()].map(r =>
      `${r.name}: ${r.prevVersion} => ${r.newVersion}${r.dependencies.length
        ? '\n' + r.dependencies.map(d =>
          `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`
        ).join('\n')
        : ''}\nAdded by: ${[...r.addedBy].map(v => v === null ? entriesAddedBy.get(r.name)! : v).join(', ')}`
    ).join('\n\n')}\n\n`)
  }

  for(const [packageName, record] of queue.entries()) {
    packages.get(packageName)!.publish(record)
  }
}
