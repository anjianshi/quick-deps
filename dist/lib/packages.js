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
exports.detectPackage = exports.findRoot = exports.Packages = void 0;
/**
 * Packages management
 */
const path = require("path");
const fs = require("fs");
const logging_1 = require("./logging");
const lang_1 = require("./lang");
const package_1 = require("./package");
const dependencies_1 = require("./dependencies");
class Packages {
    constructor(root, packagesMap) {
        this._dependencies = null;
        this.root = root;
        this._packages = packagesMap;
    }
    static load(root = '') {
        return __awaiter(this, void 0, void 0, function* () {
            if (!root)
                root = yield findRoot();
            return new Promise((resolve, reject) => {
                fs.readdir(root, (err, items) => __awaiter(this, void 0, void 0, function* () {
                    if (err)
                        return reject(err);
                    const map = new Map();
                    for (const item of items) {
                        const dirpath = path.join(root, item);
                        try {
                            const pkg = yield package_1.Package.getPackage(dirpath);
                            map.set(pkg.name, pkg);
                        }
                        catch (_a) { } // 忽略不是合法 package 的项目
                    }
                    resolve(new Packages(root, map));
                }));
            });
        });
    }
    has(name) { return this._packages.has(name); }
    get(name) { return this._packages.get(name); }
    keys() { return this._packages.keys(); }
    values() { return this._packages.values(); }
    entries() { return this._packages.entries(); }
    [Symbol.iterator]() { return this._packages.entries(); }
    get dependencies() {
        if (!this._dependencies)
            this._dependencies = dependencies_1.resolveDependencies(this);
        return this._dependencies;
    }
}
exports.Packages = Packages;
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
                        yield package_1.Package.getPackage(subpath); // 能成功读到 package.json 不报错，说明这子目录是一个合法 package
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
function detectPackage(packages) {
    var _a;
    const packageDirName = (_a = path.resolve(process.cwd())
        .slice(packages.root.length + 1)
        .split(path.delimiter)[0]) !== null && _a !== void 0 ? _a : null;
    if (packageDirName) {
        const packageDir = path.join(packages.root, packageDirName);
        for (const pkg of packages.values()) {
            if (lang_1.isSamePath(pkg.path, packageDir))
                return pkg;
        }
    }
    return null;
}
exports.detectPackage = detectPackage;
