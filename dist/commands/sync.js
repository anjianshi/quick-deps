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
const analytics_1 = require("../lib/analytics");
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
        const root = yield packages_1.findRoot();
        const packages = yield packages_1.getPackages(root);
        const dependencies = analytics_1.resolveDependencies(packages);
        // 找出依赖过时的包
        const entries = new Map();
        for (const pkg of packages.values()) {
            for (const [dep, depVersion] of pkg.dependencies.entries()) {
                const depPackage = packages.get(dep);
                if (!depPackage)
                    continue;
                const versionDiff = analytics_1.diffVersion(depVersion, depPackage.version);
                if (versionDiff.diff === -1) {
                    entries.set(pkg.name, versionDiff.keyword);
                }
            }
        }
        // 生成所有需要更新的相关包的更新队列，依次发布新版
        const updates = [];
        const queue = analytics_1.arrangePublishQueue(entries, packages, dependencies);
        for (const [packageName, newVersion] of queue.entries()) {
            const pkg = packages.get(packageName);
            const prevVersion = pkg.version;
            pkg.version = newVersion;
            // 此包的依赖可能也在此次更新队列里，版本号也变化了，那么在此也要更新依赖的版本号
            const updatedDependencies = [];
            for (const [dep, depVersion] of pkg.dependencies) {
                if (queue.has(dep)) {
                    const depNewVersion = analytics_1.parseVersion(depVersion).prefix + queue.get(dep);
                    pkg.dependencies.set(dep, depNewVersion);
                    updatedDependencies.push({ name: dep, prevVersion: pkg.dependencies.get(dep), newVersion: depNewVersion });
                }
            }
            updates.push({
                name: packageName,
                prevVersion,
                newVersion,
                dependencies: updatedDependencies
            });
        }
        logging_1.default(`\nSync:\n${updates.map(u => `${u.name}: ${u.prevVersion} => ${u.newVersion}${u.dependencies.length
            ? '\n' + u.dependencies.map(d => `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`).join('\n')
            : ''}`).join('\n\n')}\n`);
        for (const updatePackageName of queue.keys()) {
            yield packages_1.publishPackage(packages.get(updatePackageName), true);
        }
    });
}
