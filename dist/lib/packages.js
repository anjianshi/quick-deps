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
exports.detectPackage = exports.findRoot = exports.markRoot = exports.Packages = void 0;
/**
 * Packages management
 */
const path = require("path");
const fs = require("fs");
const logging_1 = require("./logging");
const lang_1 = require("./lang");
const package_1 = require("./package");
const dependencies_1 = require("./dependencies");
const ROOT_FILENAME = '.packages-root'; // 标记根目录的文件名
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
            const map = new Map();
            for (const pkg of yield getPackagesUnderDirectory(root)) {
                map.set(pkg.name, pkg);
            }
            return new Packages(root, map);
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
 * 将指定目录标记为 packages 根目录
 */
function markRoot(dirpath) {
    return __awaiter(this, void 0, void 0, function* () {
        const filepath = path.join(dirpath, ROOT_FILENAME);
        fs.writeFileSync(filepath, '');
    });
}
exports.markRoot = markRoot;
/**
 * 找到 packages 根目录，返回它的绝对路径
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
    return fs.existsSync(path.join(dirpath, ROOT_FILENAME));
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
/**
 * 递归找出目录及其子目录下的所有 packages
 */
function getPackagesUnderDirectory(dirpath) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = [];
        const directorys = (yield lang_1.readdir(dirpath, true)).filter(item => item.isDirectory());
        for (const item of directorys) {
            const itempath = path.join(dirpath, item.name);
            try {
                const pkg = yield package_1.Package.getPackage(itempath);
                result.push(pkg);
            }
            catch (_a) { } // 忽略不是合法 package 的项目
            if (!isIgnoreDirectory(item.name)) {
                result.push(...yield getPackagesUnderDirectory(itempath));
            }
        }
        return result;
    });
}
/**
 * 符合条件的目录不检测其下的 packages
 */
function isIgnoreDirectory(name) {
    return name.startsWith('.') || name === 'node_modules';
}
