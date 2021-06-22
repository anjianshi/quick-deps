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
const path = require("path");
const quick_args_1 = require("quick-args");
const logging_1 = require("../lib/logging");
const packages_1 = require("../lib/packages");
const dependencies_1 = require("../lib/dependencies");
const semver_1 = require("../lib/semver");
exports.default = new quick_args_1.Command({
    name: 'publish',
    describe: "publish a new version of specified package",
    handler: publishHandler
}).rest({
    name: 'packages',
    describe: 'specify packages to publish, pass package name or package directory name',
    required: false,
}).named({
    name: 'version',
    short: 'v',
    describe: 'specify new version or increment type: major minor patch',
});
function publishHandler(args) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield publish((_a = args.packages) !== null && _a !== void 0 ? _a : [], (_b = args.version) !== null && _b !== void 0 ? _b : '');
        }
        catch (e) {
            console.error(e);
        }
    });
}
function publish(packageNames, versionKeyword) {
    return __awaiter(this, void 0, void 0, function* () {
        const packages = yield packages_1.Packages.load();
        // 解析版本更新参数
        let versionUpdates;
        if (versionKeyword) {
            versionUpdates = semver_1.isSemVerLevel(versionKeyword)
                ? versionKeyword
                : semver_1.SemVer.parse(versionKeyword);
            if (!versionUpdates)
                throw new Error(`Invalid version keyword ${versionKeyword}`);
        }
        else {
            versionUpdates = null;
        }
        // 确认要发新版的 package
        function confirmPublishPackage(packageName) {
            if (packages.has(packageName)) {
                return packages.get(packageName);
            }
            else {
                const packagePath = path.join(packages.root, packageName);
                const detectedPkg = [...packages.values()].find(p => p.path === packagePath);
                if (detectedPkg)
                    return detectedPkg;
                else
                    throw new Error(`Package ${packageName} not exists`);
            }
        }
        const entryPackages = packageNames.map(confirmPublishPackage);
        // 生成所有需要更新的相关包的更新队列，依次发布新版
        const queue = dependencies_1.arrangePublishQueue(new Map(entryPackages.map(pkg => [pkg.name, versionUpdates || pkg.version])), packages);
        logging_1.default(`\nUpdates:\n${[...queue.values()].map(r => `${r.name}: ${r.prevVersion} => ${r.newVersion}${r.dependencies.length
            ? '\n' + r.dependencies.map(d => `  |- ${d.name}: ${d.prevVersion} => ${d.newVersion}`).join('\n')
            : ''}\nAdded by: ${[...r.addedBy].map(v => v === null ? 'entry' : v).join(', ')}`).join('\n\n')}\n\n`);
        for (const [packageName, record] of queue.entries()) {
            yield packages.get(packageName).publish(record);
        }
    });
}
