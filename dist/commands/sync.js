"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const quick_args_1 = require("quick-args");
const logging_1 = require("../lib/logging");
const packages_1 = require("../lib/packages");
const dependencies_1 = require("../lib/dependencies");
exports.default = new quick_args_1.Command({
    name: 'sync',
    describe: "Keep packages depends newest version from each other.",
    handler: syncHandler,
});
function syncHandler() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield executeSync();
        }
        catch (e) {
            console.error(e);
        }
    });
}
function executeSync() {
    return __awaiter(this, void 0, void 0, function* () {
        const packages = yield packages_1.Packages.load();
        // find packages that has outdate dependencies
        const entries = new Map();
        const entriesAddedBy = new Map();
        for (const pkg of packages.values()) {
            for (const [dep, depVersion] of pkg.dependencies.entries()) {
                const depPackage = packages.get(dep);
                if (!depPackage)
                    continue;
                const versionDiff = depVersion.diff(depPackage.version);
                if (versionDiff.diff === -1) {
                    entries.set(pkg.name, versionDiff.level);
                    entriesAddedBy.set(pkg.name, dep);
                    pkg.dependencies.set(dep, depPackage.version.withPrefix(depVersion.prefix));
                }
            }
        }
        // generate publish queue for outdated packages, and packages that depends theme.
        const queue = dependencies_1.arrangePublishQueue(entries, packages);
        logging_1.default(makeSyncLog(queue, entriesAddedBy));
        for (const [packageName, record] of queue.entries()) {
            packages.get(packageName).publish(record);
        }
    });
}
function makeSyncLog(queue, entriesAddedBy) {
    if (!queue.size)
        return 'Everything is OK.';
    function makePackageLog(record) {
        const main = `${record.name}: ${record.prevVersion} => ${record.newVersion}`;
        const dependencies = record.dependencies.length
            ? '\n' + record.dependencies.map(dep => `  |- ${dep.name}: ${dep.prevVersion} => ${dep.newVersion}`).join('\n')
            : '';
        const source = `\nAdded by: ${[...record.addedBy].map(v => v === null ? entriesAddedBy.get(record.name) : v).join(', ')}`;
        return `${main}${dependencies}${source}`;
    }
    const packageLogs = [...queue.values()]
        .map(makePackageLog)
        .join('\n\n');
    return `\nSync:\n${packageLogs}\n\n`;
}
