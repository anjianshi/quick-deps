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
    prefix: string;
    major: number;
    minor: number;
    patch: number;
    /**
     * 解析 semver 格式的版本号
     * 对于不合法或不支持的格式，返回 null
     */
    static parse(version: string): SemVer | null;
    constructor(prefix: string, major: number, minor: number, patch: number);
    /**
     * 判断两个版本号是否有差别
     *
     * 版本号相同：             { diff: 0 }
     * 当前版本高于 other：     { diff: 1, level }
     * 当前版本低于 other：     { diff: -1, level }
     *
     * 目前没有对 prefix 进行对比（注意：以后如果真的有需要对比，level 的取值要加上 prefix）
     */
    diff(other: SemVer): SemVerDiff;
    /**
     * 根据规则生成新的版本号（返回一个新的 SemVer 对象）
     */
    update(updates: SemVer | SemVerLevel): SemVer;
    toString(): string;
}
export declare function isSemVerLevel(keyword: string): keyword is SemVerLevel;
