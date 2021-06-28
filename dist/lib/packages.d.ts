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
 * 找到 packages 根目录
 *
 * 规则：
 * - 如果 `当前目录` 下有任意 `子目录` 直接包含一个 `package.json` 文件，则认为 `当前目录` 是 `根目录`。
 * - 否则递归向上查找，直到找到最上层。
 * - 如果最终还是没找到，依然把当前目录视为 `根目录`，但是因为当前目录下没有符合要求的 package，所以是空的，不会触发任何行为。
 *
 * 返回 packages 根目录的绝对路径
 */
export declare function findRoot(): Promise<string>;
/**
 * 确认当前是否在某一个 package 文件夹中，如果是，返回 package name
 */
export declare function detectPackage(packages: Packages): Package | null;
