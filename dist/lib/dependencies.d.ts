/**
 * 实现对包依赖关系等的分析
 */
import type { Packages } from './packages';
import type { SemVerLevel } from './semver';
import { SemVer } from './semver';
/**
 * 生成 packages 间的依赖关系树
 */
export declare type DependenciesTree = Map<string, DependenciesLeaf>;
interface DependenciesLeaf {
    name: string;
    dependencies: DependenciesTree;
    usedBy: DependenciesTree;
}
export declare function resolveDependencies(packages: Packages): DependenciesTree;
/**
 * 基于初始要更新的包列表，生成完整的待更新包队列（需要先更新的排在队列前面）
 * (一个包更新后，依赖它的包也要跟着更新，且这些包发布要有先后顺序，因此需要这样一个计算函数)
 */
export declare function arrangePublishQueue(entries: Map<string, SemVer | SemVerLevel>, // 初始要更新的包 Map(packageName => new version or version updates)
packages: Packages): Map<string, PublishRecord>;
/**
 * 返回与指定包有关联（依赖或间接依赖）的所有包
 */
declare type RelatedRecord = Set<string | null>;
export interface PublishRecord {
    name: string;
    prevVersion: SemVer;
    newVersion: SemVer;
    dependencies: PublishDependenciesRecord[];
    addedBy: RelatedRecord;
}
export interface PublishDependenciesRecord {
    name: string;
    prevVersion: SemVer;
    newVersion: SemVer;
}
export {};
