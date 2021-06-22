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
exports.Package = void 0;
/**
 * Package operating
 */
const path = require("path");
const fs = require("fs");
const lang_1 = require("./lang");
const semver_1 = require("./semver");
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
