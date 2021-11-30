import { Package } from './package';
import type { DependenciesTree } from './dependencies';
export declare class Packages {
    static load(root?: string): Promise<Packages>;
    root: string;
    private _packages;
    constructor(root: string, packagesMap: Map<string, Package>);
    has(name: string): boolean;
    get(name: string): Package | undefined;
    keys(): IterableIterator<string>;
    values(): IterableIterator<Package>;
    entries(): IterableIterator<[string, Package]>;
    [Symbol.iterator](): IterableIterator<[string, Package]>;
    _dependencies: null | DependenciesTree;
    get dependencies(): DependenciesTree;
}
/**
 * 将指定目录标记为 packages 根目录
 */
export declare function markRoot(dirpath: string): Promise<void>;
/**
 * 找到 packages 根目录，返回它的绝对路径
 */
export declare function findRoot(): Promise<string>;
/**
 * 确认当前是否在某一个 package 文件夹中，如果是，返回 package name
 */
export declare function detectPackage(packages: Packages): Package | null;
