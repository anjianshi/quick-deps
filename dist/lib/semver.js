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
     * Parse semver version number.
     * Return `null` if it is invalid, or it's format is not supported yet.
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
     * Compare to another version number, return the difference.
     *
     * same：                         { diff: 0 }
     * current higher than another：  { diff: 1, level }
     * current lower than another：   { diff: -1, level }
     *
     * Currently compare with `prefix` was not supported.
     * (Remember represent `prefix difference` info `level` field, when implements `prefix compare`)
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
     * Generate new version number by request. (Returns new SemVer object)
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
     * Returns a SemVer object with specified `prefix`
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
