import * as path from 'path'
import { Command } from 'quick-args'
import logging from '../lib/logging'
import type { Package } from '../lib/package'
import { Packages, detectPackage } from '../lib/packages'
import { arrangePublishQueue, PublishRecord } from '../lib/dependencies'
import { SemVer, isSemVerLevel, SemVerLevel } from '../lib/semver'


export default new Command({
  name: 'publish',
  describe: "Publish new version for specified packages",
  handler: publishHandler
}).rest({
  name: 'packages',
  describe: 'Specify packages to publish, pass package name or package directory name',
  required: false,
}).named({
  name: 'version',
  short: 'v',
  describe: 'Specify new version or increment type: major minor patch',
})


async function publishHandler(args: { packages?: string[], version?: string }) {
  try {
    await publish(args.packages ?? [], args.version ?? '')
  } catch(e) {
    console.error(e)
  }
}


async function publish(packageKeywords: string[], rawVersionUpdates: string) {
  const packages = await Packages.load()

  // parse version update settings
  let versionUpdates: SemVer | SemVerLevel | null
  if (rawVersionUpdates) {
    versionUpdates = isSemVerLevel(rawVersionUpdates)
      ? rawVersionUpdates
      : SemVer.parse(rawVersionUpdates)
    if (!versionUpdates) throw new Error(`Invalid version description ${rawVersionUpdates}`)
  } else {
    versionUpdates = null
  }

  // confirm packages to publish
  let entryPackages: Package[]
  if (packageKeywords.length) {
    entryPackages = packageKeywords.map(keyword => confirmPublishPackage(keyword, packages))
  } else {
    const detected = detectPackage(packages)
    if (!detected) throw new Error(`Not in package directory, need specify package name`)
    entryPackages = [detected]
  }

  // generate publish queue for entry packages and the packages depends them
  const queue = arrangePublishQueue(
    new Map(entryPackages.map(pkg => [pkg.name, versionUpdates || pkg.version])),
    packages,
  )

  logging(makePublishLog(queue))

  // publish packages in queue
  for(const [packageName, record] of queue.entries()) {
    await packages.get(packageName)!.publish(record)
  }
}


/**
 * Return the package object corresponding to specified keyword.
 */
function confirmPublishPackage(keyword: string, packages: Packages) {
  // if the keyword exactly a package's name, return it directly
  if (packages.has(keyword)) return packages.get(keyword)!

  // confirm is the keyword is a packages's directory name
  const packagePath = path.join(packages.root, keyword)
  const detectedPkg = [...packages.values()].find(p => p.path === packagePath)
  if (detectedPkg) return detectedPkg

  // cannot find the package
  throw new Error(`Package ${keyword} not exists`)
}


function makePublishLog(queue: Map<string, PublishRecord>) {
  function makePackageLog(record: PublishRecord) {
    const main = `${record.name}: ${record.prevVersion} => ${record.newVersion}`
    const dependencies = record.dependencies.length
      ? '\n' + record.dependencies.map(dep => `  |- ${dep.name}: ${dep.prevVersion} => ${dep.newVersion}`).join('\n')
      : ''
    const source = `\nAdded by: ${[...record.addedBy].map(v => v === null ? 'entry' : v).join(', ')}`
    return `${main}${dependencies}${source}`
  }

  const packageLogs = [...queue.values()]
    .map(makePackageLog)
    .join('\n\n')

  return `\nUpdates:\n${packageLogs}\n\n`
}
