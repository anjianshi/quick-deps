/**
 * Semantic Versioning (https://semver.org/) related tools
 */
export declare type SemVerLevel = 'major' | 'minor' | 'patch';
export declare type SemVerDiff = {
    diff: 0;
} | {
    diff: 1;
    level: SemVerLevel;
} | {
    diff: -1;
    level: SemVerLevel;
};
export declare class SemVer {
    /**
     * Parse semver version number.
     * Return `null` if it is invalid, or it's format is not supported yet.
     */
    static parse(version: string): SemVer | null;
    prefix: string;
    major: number;
    minor: number;
    patch: number;
    constructor(data: {
        prefix?: string;
        major: number;
        minor: number;
        patch: number;
    });
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
    diff(that: SemVer): SemVerDiff;
    /**
     * Generate new version number by request. (Returns new SemVer object)
     */
    update(updates: SemVer | SemVerLevel): SemVer;
    /**
     * Returns a SemVer object with specified `prefix`
     */
    withPrefix(prefix: string): SemVer;
    toString(): string;
}
export declare function isSemVerLevel(keyword: string): keyword is SemVerLevel;
