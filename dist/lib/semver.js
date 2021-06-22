"use strict";
/**
 * Semantic Versioning (https://semver.org/) related tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSemVerLevel = exports.SemVer = void 0;
class SemVer {
    constructor(data) {
        var _a;
        this.prefix = (_a = data.prefix) !== null && _a !== void 0 ? _a : '';
        this.major = data.major;
        this.minor = data.minor;
        this.patch = data.patch;
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
            const [major, minor, patch] = [rawMajor, rawMinor, rawPatch].map(v => parseInt(v, 10));
            return new SemVer({ prefix, major, minor, patch });
        }
        return null;
    }
    /**
     * 判断两个版本号是否有差别
     *
     * 版本号相同：             { diff: 0 }
     * 当前版本高于 that：      { diff: 1, level }
     * 当前版本低于 that：      { diff: -1, level }
     *
     * 目前没有对 prefix 进行对比（注意：以后如果真的有需要对比，level 的取值要加上 prefix）
     */
    diff(that) {
        for (const level of ['major', 'minor', 'patch']) {
            if (this[level] > that[level])
                return { diff: 1, level };
            else if (this[level] < that[level])
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
        const { prefix, major, minor, patch } = this;
        if (updates === 'major')
            return new SemVer({ prefix, major: major + 1, minor: 0, patch: 0 });
        else if (updates === 'minor')
            return new SemVer({ prefix, major, minor: minor + 1, patch: 0 });
        else
            return new SemVer({ prefix, major, minor, patch: patch + 1 });
    }
    /**
     * 返回一个带指定 prefix 的新 SemVer 对象
     */
    withPrefix(prefix) {
        return new SemVer(Object.assign(Object.assign({}, this), { prefix }));
    }
    toString() {
        return `${this.prefix}${this.major}.${this.minor}.${this.patch}`;
    }
}
exports.SemVer = SemVer;
function isSemVerLevel(keyword) {
    return keyword === 'major' || keyword === 'minor' || keyword === 'patch';
}
exports.isSemVerLevel = isSemVerLevel;
