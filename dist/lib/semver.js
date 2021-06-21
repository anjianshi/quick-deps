"use strict";
/**
 * Semantic Versioning (https://semver.org/) related tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSemVerLevel = exports.SemVer = void 0;
class SemVer {
    constructor(prefix, major, minor, patch) {
        this.prefix = prefix;
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }
    /**
     * 解析 semver 格式的版本号
     * 对于不合法或不支持的格式，返回 null
     */
    static parse(version) {
        const pattern = /^(>=|>|<=|<|~|\^)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
        const match = version.match(pattern);
        if (match) {
            const [prefix = '', rawMajor, rawMinor, rawPatch] = match.slice(1);
            const [major, minor, patch] = [rawMajor, rawMinor, rawPatch].map(toNumber);
            return new SemVer(prefix, major, minor, patch);
        }
        return null;
    }
    /**
     * 判断两个版本号是否有差别
     *
     * 版本号相同：             { diff: 0 }
     * 当前版本高于 other：     { diff: 1, level }
     * 当前版本低于 other：     { diff: -1, level }
     *
     * 目前没有对 prefix 进行对比（注意：以后如果真的有需要对比，level 的取值要加上 prefix）
     */
    diff(other) {
        for (const level of ['major', 'minor', 'patch']) {
            if (this[level] > other[level])
                return { diff: 1, level };
            else if (this[level] < other[level])
                return { diff: -1, level };
        }
        return { diff: 0 };
    }
    /**
     * 根据规则生成新的版本号（返回一个新的 SemVer 对象）
     */
    update(updates) {
        if (typeof updates !== 'string')
            return updates;
        let { prefix, major, minor, patch } = this;
        if (updates === 'major')
            return new SemVer(prefix, major + 1, 0, 0);
        else if (updates === 'minor')
            return new SemVer(prefix, major, minor + 1, 0);
        else
            return new SemVer(prefix, major, minor, patch + 1);
    }
    toString() {
        return `${this.prefix}${this.major}.${this.minor}.${this.patch}`;
    }
}
exports.SemVer = SemVer;
function toNumber(str) {
    const parsed = parseInt(str, 10);
    return isFinite(parsed) ? parsed : 0;
}
function isSemVerLevel(keyword) {
    return keyword === 'major' || keyword === 'minor' || keyword === 'patch';
}
exports.isSemVerLevel = isSemVerLevel;
