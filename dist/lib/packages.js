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
exports.publishPackage = exports.writePackage = exports.getPackage = exports.getPackages = exports.detectPackage = exports.findRoot = void 0;
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
                        yield getPackage(subpath); // 能成功读到 package.json 不报错，说明这子目录是一个合法 package
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
                    const pkg = yield getPackage(dirpath);
                    map.set(pkg.name, pkg);
                }
                catch (_a) { } // 忽略不是合法 package 的项目
            }
            resolve(map);
        }));
    });
}
exports.getPackages = getPackages;
/**
 * 获取指定 package 的信息
 * 若指定目录不是一个合法 package，抛出对应异常
 */
function getPackage(dirpath) {
    return __awaiter(this, void 0, void 0, function* () {
        const [raw, rawString] = yield getInfoFromPackageJSON(dirpath);
        const formatted = formatInfoFromPackageJSON(raw, rawString, dirpath);
        if (!formatted)
            throw new Error('package format failed');
        return formatted;
    });
}
exports.getPackage = getPackage;
/**
 * 获取指定 package 的 package.json 内容
 * 若指定目录不是一个合法 package，抛出对应异常
 */
function getInfoFromPackageJSON(dirpath) {
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
function formatInfoFromPackageJSON(raw, rawString, dirpath) {
    var _a, _b, _c, _d, _e;
    const version = semver_1.SemVer.parse((_a = raw.version) !== null && _a !== void 0 ? _a : '');
    if (!version)
        return null;
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
    return {
        name: ((_e = raw.name) !== null && _e !== void 0 ? _e : '') || fallbackName,
        version: version,
        dependencies,
        raw,
        rawString,
        path: dirpath,
    };
}
/**
 * 将包信息写入到指定 package 的 package.json 里
 */
function writePackage(pkg, writeRaw = false) {
    let json;
    if (writeRaw) {
        json = pkg.rawString;
    }
    else {
        const updated = Object.assign({}, pkg.raw);
        updated.name = pkg.name;
        updated.version = pkg.version.toString();
        for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
            if (isEmpty(updated[depType]))
                continue;
            const source = updated[depType];
            for (const [depName, depVersion] of pkg.dependencies) {
                source[depName] = depVersion.toString();
            }
        }
        json = JSON.stringify(updated, null, 2);
        const endString = pkg.rawString.slice(pkg.rawString.lastIndexOf('}') + 1);
        json += endString;
    }
    return new Promise((resolve, reject) => {
        const jsonpath = path.join(pkg.path, 'package.json');
        fs.writeFile(jsonpath, json, err => {
            if (err)
                return reject(new Error(`update "${jsonpath}" failed：${err}`));
            resolve();
        });
    });
}
exports.writePackage = writePackage;
function isEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
}
/**
 * 对指定 package 执行 publish 操作
 */
function publishPackage(pkg, shouldSyncDependencies = true) {
    return __awaiter(this, void 0, void 0, function* () {
        yield writePackage(pkg);
        try {
            if (shouldSyncDependencies)
                yield syncDependencies(pkg);
            yield lang_1.execute('npm publish', { cwd: pkg.path });
        }
        catch (e) {
            // 发布失败，还原 package.json 内容
            yield writePackage(pkg, true);
            throw e;
        }
    });
}
exports.publishPackage = publishPackage;
/**
 * 安装指定包的依赖
 */
function syncDependencies(pkg) {
    return __awaiter(this, void 0, void 0, function* () {
        let hasYarnBin = true;
        try {
            yield lang_1.execute('yarn --version', { cwd: pkg.path });
        }
        catch (e) {
            hasYarnBin = false;
        }
        const useYarn = hasYarnBin && ((yield lang_1.fileExists(path.join(pkg.path, 'yarn.lock')))
            || !(yield lang_1.fileExists(path.join(pkg.path, 'package-lock.json'))));
        const command = useYarn ? 'yarn' : 'npm install';
        yield lang_1.execute(command, { cwd: pkg.path });
    });
}
