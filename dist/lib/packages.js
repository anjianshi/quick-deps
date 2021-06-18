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
 * package 信息相关工具函数
 */
const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");
const logging_1 = require("./logging");
const analytics_1 = require("./analytics");
// ==============================
// Root
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
            if (isSamePath(pkg.path, packageDir))
                return pkg;
        }
    }
    return null;
}
exports.detectPackage = detectPackage;
/**
 * 判断两个路径是否相同
 */
function isSamePath(a, b) {
    return path.resolve(a) === path.resolve(b);
}
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
        return formatInfoFromPackageJSON(raw, rawString, dirpath);
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
    const fallbackName = path.basename(dirpath);
    const dependencies = new Map();
    const rawDependencies = [...Object.entries((_a = raw.dependencies) !== null && _a !== void 0 ? _a : {}), ...Object.entries((_b = raw.devDependencies) !== null && _b !== void 0 ? _b : {}), ...Object.entries((_c = raw.peerDependencies) !== null && _c !== void 0 ? _c : {})];
    for (const [name, version] of rawDependencies) {
        // 同一个依赖出现两次，取版本号最大的
        if (dependencies.has(name)) {
            if (analytics_1.diffVersion(version, dependencies.get(name)).diff === 1)
                dependencies.set(name, version);
        }
        else {
            dependencies.set(name, version);
        }
    }
    return {
        raw,
        rawString,
        path: dirpath,
        name: ((_d = raw.name) !== null && _d !== void 0 ? _d : '') || fallbackName,
        version: ((_e = raw.version) !== null && _e !== void 0 ? _e : '') || '0.0.1',
        dependencies,
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
        updated.version = pkg.version;
        for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
            if (isEmpty(updated[depType]))
                continue;
            const source = updated[depType];
            for (const [depName, devVersion] of Object.entries(source)) {
                const newVersion = pkg.dependencies.get(depName);
                if (devVersion !== newVersion)
                    source[depName] = newVersion;
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
    return !obj || Object.keys(obj).length > 0;
}
/**
 * 对指定 package 执行 publish 操作
 */
function publishPackage(pkg, shouldSyncDependencies = false) {
    return __awaiter(this, void 0, void 0, function* () {
        yield writePackage(pkg);
        try {
            if (shouldSyncDependencies)
                yield syncDependencies(pkg);
            yield execute('npm publish', pkg.path);
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
            yield execute('yarn --version', pkg.path);
        }
        catch (e) {
            hasYarnBin = false;
        }
        const useYarn = hasYarnBin && ((yield fileExists(path.join(pkg.path, 'yarn.lock')))
            || !(yield fileExists(path.join(pkg.path, 'package-lock.json'))));
        if (useYarn)
            yield execute('yarn', pkg.path);
        else
            yield execute('npm install', pkg.path);
    });
}
function execute(command, cwd, stdio = 'inherit') {
    return new Promise((resolve, reject) => {
        logging_1.default(cwd ? `Execute: \`${command}\` at ${cwd}` : `Execute: \`${command}\``);
        const proc = childProcess.spawn(command, Object.assign(Object.assign({}, cwd ? { cwd } : {}), { shell: true, stdio }));
        proc.on('error', reject);
        proc.on('exit', code => {
            if (code !== 0)
                reject(new Error(`Command execute failed: ${code}`));
            else
                resolve();
        });
    });
}
function fileExists(filepath) {
    return new Promise(resolve => {
        fs.stat(filepath, (err, stat) => {
            resolve(stat && stat.isFile());
        });
    });
}
