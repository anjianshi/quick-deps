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
function publish(packageKeywords, rawVersionUpdates) {
    return __awaiter(this, void 0, void 0, function* () {
        const packages = yield packages_1.Packages.load();
        // parse version update settings
        let versionUpdates;
        if (rawVersionUpdates) {
            versionUpdates = semver_1.isSemVerLevel(rawVersionUpdates)
                ? rawVersionUpdates
                : semver_1.SemVer.parse(rawVersionUpdates);
            if (!versionUpdates)
                throw new Error(`Invalid version description ${rawVersionUpdates}`);
        }
        else {
            versionUpdates = null;
        }
        // confirm packages to publish
        let entryPackages;
        if (packageKeywords.length) {
            entryPackages = packageKeywords.map(keyword => confirmPublishPackage(keyword, packages));
        }
        else {
            const detected = packages_1.detectPackage(packages);
            if (!detected)
                throw new Error(`Not in package directory, need specify package name`);
            entryPackages = [detected];
        }
        // generate publish queue for entry packages and the packages depends them
        const queue = dependencies_1.arrangePublishQueue(new Map(entryPackages.map(pkg => [pkg.name, versionUpdates || pkg.version])), packages);
        logging_1.default(makePublishLog(queue));
        // publish packages in queue
        for (const [packageName, record] of queue.entries()) {
            yield packages.get(packageName).publish(record);
        }
    });
}
/**
 * Return the package object corresponding to specified keyword.
 */
function confirmPublishPackage(keyword, packages) {
    // if the keyword exactly a package's name, return it directly
    if (packages.has(keyword))
        return packages.get(keyword);
    // confirm is the keyword is a packages's directory name
    const packagePath = path.join(packages.root, keyword);
    const detectedPkg = [...packages.values()].find(p => p.path === packagePath);
    if (detectedPkg)
        return detectedPkg;
    // cannot find the package
    throw new Error(`Package ${keyword} not exists`);
}
function makePublishLog(queue) {
    function makePackageLog(record) {
        const main = `${record.name}: ${record.prevVersion} => ${record.newVersion}`;
        const dependencies = record.dependencies.length
            ? '\n' + record.dependencies.map(dep => `  |- ${dep.name}: ${dep.prevVersion} => ${dep.newVersion}`).join('\n')
            : '';
        const source = `\nAdded by: ${[...record.addedBy].map(v => v === null ? 'entry' : v).join(', ')}`;
        return `${main}${dependencies}${source}`;
    }
    const packageLogs = [...queue.values()]
        .map(makePackageLog)
        .join('\n\n');
    return `\nUpdates:\n${packageLogs}\n\n`;
}
