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
export declare function detectPackage(root: string, packages: Packages): Package | null;
export declare type Packages = Map<string, Package>;
/**
 * 获取根目录下各 package 的 package.json 内容
 */
export declare function getPackages(root: string): Promise<Packages>;
interface InfoFromPackageJSON {
    name?: string;
    version?: string;
    dependencies?: {
        [name: string]: string;
    };
    devDependencies?: {
        [name: string]: string;
    };
    peerDependencies?: {
        [name: string]: string;
    };
}
export interface Package {
    name: string;
    version: string;
    dependencies: Map<string, string>;
    raw: InfoFromPackageJSON & {
        [key: string]: any;
    };
    rawString: string;
    path: string;
}
/**
 * 获取指定 package 的信息
 * 若指定目录不是一个合法 package，抛出对应异常
 */
export declare function getPackage(dirpath: string): Promise<Package>;
/**
 * 将包信息写入到指定 package 的 package.json 里
 */
export declare function writePackage(pkg: Package, writeRaw?: boolean): Promise<void>;
/**
 * 对指定 package 执行 publish 操作
 */
export declare function publishPackage(pkg: Package, shouldSyncDependencies?: boolean): Promise<void>;
export {};
