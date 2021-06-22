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
exports.Package = exports.getPackages = exports.detectPackage = exports.findRoot = void 0;
/**
 * package management functions
 */
const path = require("path");
const fs = require("fs");
const logging_1 = require("./logging");
const lang_1 = require("./lang");
const semver_1 = require("./semver");
// ==============================
// Packages Root
// ==============================
/**
 * 找到 packages 根目录
 *
 * 规则：
 * - 如果 `当前目录` 下有任意 `子目录` 直接包含一个 `package.json` 文件，则认为 `当前目录` 是 `根目录`。
 * - 否则递归向上查找，直到找到最上层。
 * - 如果最终还是没找到，依然把当前目录视为 `根目录`，但是因为当前目录下没有符合要求的 package，所以是空的，不会触发任何行为。
 *
 * 返回 packages 根目录的绝对路径
 */
function findRoot() {
    return __awaiter(this, void 0, void 0, function* () {
        const initial = path.resolve(process.cwd());
        let checking = initial;
        while (true) {
            // 找到 packages 根目录
            const result = yield detectIsRoot(checking);
            logging_1.default(`detecting root "${checking}": ${result ? 'true' : 'false'}`);
            if (result)
                return checking;
            // 向上递归
            const parent = path.dirname(checking);
            if (parent === checking) {
                logging_1.default(`use current path as root: ${initial}`);
                return initial; // 如果已经没有上级目录了，返回初始目录
            }
            checking = parent;
        }
    });
}
exports.findRoot = findRoot;
/**
 * 判断一个目录是否是 packages 根目录
 */
function detectIsRoot(dirpath) {
    return new Promise(resolve => {
        // 遍历目录下的内容，若能一个合法的 package，便视为是一个 packages 根目录
        fs.readdir(dirpath, { withFileTypes: true }, (err, files) => __awaiter(this, void 0, void 0, function* () {
            // 目录内容读取失败
            if (err)
                return resolve(false);
            // 遍历各子目录，看能否找到一个合法 package
            for (const item of files) {
                if (item.isDirectory()) {
                    const subpath = path.join(dirpath, item.name);
                    try {
                        yield Package.getPackage(subpath); // 能成功读到 package.json 不报错，说明这子目录是一个合法 package
                        return resolve(true);
                    }
                    catch (_a) { }
                }
            }
            // 指定目录下没有找到合法 package
            resolve(false);
        }));
    });
}
/**
 * 确认当前是否在某一个 package 文件夹中，如果是，返回 package name
 */
function detectPackage(root, packages) {
    var _a;
    const packageDirName = (_a = path.resolve(process.cwd())
        .slice(root.length + 1)
        .split(path.delimiter)[0]) !== null && _a !== void 0 ? _a : null;
    if (packageDirName) {
        const packageDir = path.join(root, packageDirName);
        for (const pkg of packages.values()) {
            if (lang_1.isSamePath(pkg.path, packageDir))
                return pkg;
        }
    }
    return null;
}
exports.detectPackage = detectPackage;
/**
 * 获取根目录下各 package 的 package.json 内容
 */
function getPackages(root) {
    return new Promise((resolve, reject) => {
        fs.readdir(root, (err, items) => __awaiter(this, void 0, void 0, function* () {
            if (err)
                return reject(err);
            const map = new Map();
            for (const item of items) {
                const dirpath = path.join(root, item);
                try {
                    const pkg = yield Package.getPackage(dirpath);
                    map.set(pkg.name, pkg);
                }
                catch (_a) { } // 忽略不是合法 package 的项目
            }
            resolve(map);
        }));
    });
}
exports.getPackages = getPackages;
class Package {
    // =========================================================
    constructor(name, version, 
    // 原 dependencies、devDependencies、peerDependencies 合并到一起以便于处理
    // 不影响最终写入到 package.json 里的内容；只是就不支持同一个依赖项在这三个种类里有不同的版本号了，不过因为设计上也要求版本号固定用最新的，所以没关系
    dependencies, 
    // 最原始的完整 package.json 数据，在 Package 对象的整个生命周期中不会改变
    raw, rawString, 
    // 此包所在路径
    path) {
        this.name = name;
        this.version = version;
        this.dependencies = dependencies;
        this.raw = raw;
        this.rawString = rawString;
        this.path = path;
    }
    /**
     * 生成指定路径的包的 Package 对象
     */
    static getPackage(dirpath) {
        return __awaiter(this, void 0, void 0, function* () {
            const [raw, rawString] = yield Package.getInfoFromPackageJSON(dirpath);
            const { name, version, dependencies } = Package.formatInfoFromPackageJSON(raw, dirpath);
            return new Package(name, version, dependencies, raw, rawString, dirpath);
        });
    }
    /**
    * 获取指定 package 的 package.json 内容
    * 若指定目录不是一个合法 package，抛出异常
    */
    static getInfoFromPackageJSON(dirpath) {
        return new Promise((resolve, reject) => {
            const jsonpath = path.join(dirpath, 'package.json');
            fs.readFile(jsonpath, (err, text) => {
                if (err)
                    return reject(new Error(`'${dirpath}' is not a valid pacakge，read package.json failed：${err}`));
                try {
                    const string = text.toString();
                    const raw = JSON.parse(string);
                    resolve([raw, string]);
                }
                catch (e) {
                    reject(new Error(`'${dirpath}' package.json invalid：${err}`));
                }
            });
        });
    }
    /**
     * 格式化从 package.json 里取得的包信息
     */
    static formatInfoFromPackageJSON(raw, dirpath) {
        var _a, _b, _c, _d, _e;
        const version = semver_1.SemVer.parse((_a = raw.version) !== null && _a !== void 0 ? _a : '');
        if (!version)
            throw new Error(`package '${raw.name}' parse failed: invalid version '${raw.version}'`);
        const dependencies = new Map();
        const rawDependencies = [
            ...Object.entries((_b = raw.dependencies) !== null && _b !== void 0 ? _b : {}),
            ...Object.entries((_c = raw.devDependencies) !== null && _c !== void 0 ? _c : {}),
            ...Object.entries((_d = raw.peerDependencies) !== null && _d !== void 0 ? _d : {})
        ];
        for (const [depName, devRawVersion] of rawDependencies) {
            const depVersion = semver_1.SemVer.parse(devRawVersion);
            if (!depVersion)
                continue;
            // 同依赖已出现过，记录版本号较大的那个
            if (!dependencies.has(depName) || depVersion.diff(dependencies.get(depName)).diff === 1) {
                dependencies.set(depName, depVersion);
            }
        }
        const fallbackName = path.basename(dirpath);
        const name = ((_e = raw.name) !== null && _e !== void 0 ? _e : '') || fallbackName;
        return { name, version, dependencies };
    }
    /**
     * 将更新过的字段值写入 package.json（不会改变 raw、rawString，因为根据情况还可能需要把原内容还原回来）
     */
    writeUpdated() {
        const updated = Object.assign({}, this.raw);
        updated.name = this.name;
        updated.version = this.version.toString();
        for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
            if (lang_1.isEmpty(updated[depType]))
                continue;
            const source = updated[depType];
            for (const depName of Object.keys(source)) {
                if (this.dependencies.has(depName))
                    source[depName] = this.dependencies.get(depName).toString();
            }
        }
        const endString = this.rawString.slice(this.rawString.lastIndexOf('}') + 1);
        const json = JSON.stringify(updated, null, 2) + endString;
        return this.write(json);
    }
    /**
     * 将原始的 package.json 内容更新回 package.json 文件
     * （仅还原 package.json 文件内容，此对象修改过的字段值并不会被还原）
     */
    restorePackageJSON() {
        this.write(this.rawString);
    }
    /**
     * 将指定内容写入此 package 的 package.json
     */
    write(json) {
        return new Promise((resolve, reject) => {
            const jsonpath = path.join(this.path, 'package.json');
            fs.writeFile(jsonpath, json, err => {
                if (err)
                    return reject(new Error(`update "${jsonpath}" failed：${err}`));
                resolve();
            });
        });
    }
    /**
     * 此包发布新版
     * - 支持传入 arrangePublishQueue() 生成的发布信息，会基于它先更新包数据再发布
     * - 因为发布、打包一般需要先安装依赖，所以 shouldSyncDependencies 默认为 true
     */
    publish(updates, shouldSyncDependencies = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (updates) {
                this.version = updates.newVersion;
                for (const depRecord of updates.dependencies.values()) {
                    this.dependencies.set(depRecord.name, depRecord.newVersion);
                }
            }
            yield this.writeUpdated(); // 将此包更新过的内容（版本号、依赖版本）写入 package.json
            try {
                if (shouldSyncDependencies)
                    yield this.syncDependencies();
                yield lang_1.execute('npm publish', { cwd: this.path });
            }
            catch (e) {
                // 发布失败，还原 package.json 内容
                yield this.restorePackageJSON();
                throw e;
            }
        });
    }
    /**
     * 安装此包的依赖项
     */
    syncDependencies() {
        return __awaiter(this, void 0, void 0, function* () {
            let hasYarnBin = true;
            try {
                yield lang_1.execute('yarn --version', { cwd: this.path });
            }
            catch (e) {
                hasYarnBin = false;
            }
            const useYarn = hasYarnBin && ((yield lang_1.fileExists(path.join(this.path, 'yarn.lock')))
                || !(yield lang_1.fileExists(path.join(this.path, 'package-lock.json'))));
            const command = useYarn ? 'yarn' : 'npm install';
            yield lang_1.execute(command, { cwd: this.path });
        });
    }
}
exports.Package = Package;
