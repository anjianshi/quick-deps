/**
 * 实现对包依赖关系等的分析
 */
import type { Packages, Package } from './packages';
export declare type SemVerKeyword = 'major' | 'minor' | 'patch';
export declare type DependenciesTree = Map<string, DependenciesLeaf>;
interface DependenciesLeaf {
    name: string;
    dependencies: DependenciesTree;
    usedBy: DependenciesTree;
}
/**
 * 分析给定各包间的依赖关系
 */
export declare function resolveDependencies(packages: Packages): DependenciesTree;
/**
 * 按 sermver 格式解析 package 版本号
 */
export declare function parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
};
/**
 * 判断两个版本号是否有差别
 *
 * 版本号相同：             { diff: 0 }
 * ver1 版本高于 ver2：     { diff: 1, keyword }
 * ver1 版本低于 ver2：     { diff: -1, keyword }
 */
export declare function diffVersion(ver1Str: string, ver2Str: string): {
    diff: 0;
} | {
    diff: 1 | -1;
    keyword: SemVerKeyword;
};
/**
 * 为 package 生成新的版本号
 *
 * keyword:
 * - 传入 major、minor、patch 按照指定规则更新（详见 semver 介绍：https://semver.org/）
 * - 传入空字符串则不更新
 * - 传入其他值则直接用这个值作为新版本号
 */
export declare function updateVersion(current: string, keyword: string): string;
export declare function arrangePublishQueue(entry: Package, entryVersionKeyword: string, // 这个参数直接传给 updateVersion()，允许不是 semVerKeyword
packages: Packages, dependencies: DependenciesTree): Map<string, string>;
export {};
