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
        const root = yield packages_1.findRoot();
        const packages = yield packages_1.getPackages(root);
        const dependencies = dependencies_1.resolveDependencies(packages);
        // 找出依赖过时的包
        const entries = new Map();
        for (const pkg of packages.values()) {
            for (const [dep, depVersion] of pkg.dependencies.entries()) {
                const depPackage = packages.get(dep);
                if (!depPackage)
                    continue;
                const versionDiff = depVersion.diff(depPackage.version);
                if (versionDiff.diff === -1)
                    entries.set(pkg.name, versionDiff.level);
            }
        }
        // 生成所有需要更新的相关包的更新队列，依次发布新版
        const queue = dependencies_1.arrangePublishQueue(entries, packages, dependencies);
        for (const [packageName, record] of queue.entries()) {
            const pkg = packages.get(packageName);
            pkg.version = record.newVersion;
            for (const depRecord of record.dependencies.values()) {
                pkg.dependencies.set(depRecord.name, depRecord.newVersion);
            }
        }
        logging_1.default(`\nSync:\n${[...queue.values()].map(r => `${r.name}: ${r.prevVersion} => ${r.newVersion}${r.dependencies.length
            ? '\n' + r.dependencies.map(d => `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`).join('\n')
            : ''}`).join('\n\n')}\n\n`);
        for (const updatePackageName of queue.keys()) {
            yield packages_1.publishPackage(packages.get(updatePackageName));
        }
    });
}
