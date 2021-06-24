import { Command } from 'quick-args'
import logging from '../lib/logging'
import { Packages } from '../lib/packages'
import { arrangePublishQueue, PublishRecord } from '../lib/dependencies'
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

  // find packages that has outdate dependencies
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

  // generate publish queue for outdated packages, and packages that depends theme.
  const queue = arrangePublishQueue(entries, packages)

  logging(makeSyncLog(queue, entriesAddedBy))

  for(const [packageName, record] of queue.entries()) {
    packages.get(packageName)!.publish(record)
  }
}


function makeSyncLog(queue: Map<string, PublishRecord>, entriesAddedBy: Map<string, string>) {
  if (!queue.size) return 'Everything is OK.'

  function makePackageLog(record: PublishRecord) {
    const main = `${record.name}: ${record.prevVersion} => ${record.newVersion}`
    const dependencies = record.dependencies.length
      ? '\n' + record.dependencies.map(dep => `  |- ${dep.name}: ${dep.prevVersion} => ${dep.newVersion}`).join('\n')
      : ''
    const source = `\nAdded by: ${[...record.addedBy].map(v => v === null ? entriesAddedBy.get(r.name)! : v).join(', ')}`
    return `${main}${dependencies}${source}`
  }

  const packageLogs = [...queue.values()]
    .map(makePackageLog)
    .join('\n\n')

  return `\nSync:\n${packageLogs}\n\n`
}
