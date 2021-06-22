import { SemVer } from './semver';
import type { PublishRecord } from './dependencies';
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
export declare class Package {
    name: string;
    version: SemVer;
    dependencies: Map<string, SemVer>;
    raw: InfoFromPackageJSON & {
        [key: string]: any;
    };
    rawString: string;
    path: string;
    /**
     * 生成指定路径的包的 Package 对象
     */
    static getPackage(dirpath: string): Promise<Package>;
    /**
    * 获取指定 package 的 package.json 内容
    * 若指定目录不是一个合法 package，抛出异常
    */
    private static getInfoFromPackageJSON;
    /**
     * 格式化从 package.json 里取得的包信息
     */
    private static formatInfoFromPackageJSON;
    constructor(name: string, version: SemVer, dependencies: Map<string, SemVer>, raw: InfoFromPackageJSON & {
        [key: string]: any;
    }, rawString: string, path: string);
    /**
     * 将更新过的字段值写入 package.json（不会改变 raw、rawString，因为根据情况还可能需要把原内容还原回来）
     */
    writeUpdated(): Promise<void>;
    /**
     * 将原始的 package.json 内容更新回 package.json 文件
     * （仅还原 package.json 文件内容，此对象修改过的字段值并不会被还原）
     */
    restorePackageJSON(): void;
    /**
     * 将指定内容写入此 package 的 package.json
     */
    private write;
    /**
     * 此包发布新版
     * - 支持传入 arrangePublishQueue() 生成的发布信息，会基于它先更新包数据再发布
     * - 因为发布、打包一般需要先安装依赖，所以 shouldSyncDependencies 默认为 true
     */
    publish(updates?: PublishRecord, shouldSyncDependencies?: boolean): Promise<void>;
    /**
     * 安装此包的依赖项
     */
    protected syncDependencies(): Promise<void>;
}
export {};
