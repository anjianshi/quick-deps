"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrangePublishQueue = exports.resolveDependencies = void 0;
function resolveDependencies(packages) {
    const root = new Map();
    function initTree(name) {
        if (!packages.has(name))
            return null; // 只处理包列表里有的依赖项
        if (!root.has(name)) {
            root.set(name, {
                name,
                dependencies: new Map(),
                usedBy: new Map(),
            });
        }
        return root.get(name);
    }
    // 初始化 packages tree，填充依赖项
    for (const pkg of packages.values()) {
        // 初始化此包的依赖树（若已经被前面的包初始化过了，会跳过初始化）
        const pkgTree = initTree(pkg.name);
        for (const dep of pkg.dependencies.keys()) {
            // 若涉及的依赖还没初始化过依赖树，这里执行以下初始化（不然没有节点可以引用）
            const depTree = initTree(dep);
            if (depTree) {
                pkgTree.dependencies.set(dep, depTree);
                depTree.usedBy.set(pkg.name, pkgTree);
            }
        }
    }
    // 清理没有任何依赖关系的 package
    for (const [name, tree] of root) {
        if (tree.dependencies.size === 0 && tree.usedBy.size === 0)
            root.delete(name);
    }
    const circularNodes = detectCircularDependency(root);
    if (circularNodes)
        throw new Error(`发现循环依赖：${circularNodes.join(' -> ')}`);
    return root;
}
exports.resolveDependencies = resolveDependencies;
/**
 * 检查依赖列表里是否有循环依赖
 * 如果有，返回循环的节点列表
 */
function detectCircularDependency(tree) {
    return _detectCircularDependency(tree, new Set());
}
function _detectCircularDependency(tree, prevLeaves) {
    // 检查当前 tree 的 leaf 有没有出现循环依赖
    for (const leaf of tree.values()) {
        if (prevLeaves.has(leaf))
            return [...prevLeaves.values(), leaf].map(v => v.name);
    }
    // 检查各 leaf 的子 tree 有没有出现循环依赖
    for (const leaf of tree.values()) {
        const detected = _detectCircularDependency(leaf.dependencies, new Set([...prevLeaves, leaf]));
        if (detected)
            return detected;
    }
    return null;
}
/**
 * 基于初始要更新的包列表，生成完整的待更新包队列（需要先更新的排在队列前面）
 * (一个包更新后，依赖它的包也要跟着更新，且这些包发布要有先后顺序，因此需要这样一个计算函数)
 */
function arrangePublishQueue(entries, // 初始要更新的包 Map(packageName => new version or version updates)
packages, dependencies) {
    const packages2publish = expandRelateds([...entries.keys()], packages, dependencies);
    return computePublishQueue(packages2publish, entries, packages, dependencies);
}
exports.arrangePublishQueue = arrangePublishQueue;
/**
 * 返回与指定包有关联（依赖或间接依赖）的所有包
 */
function expandRelateds(packageNames, packages, dependencies) {
    const relateds = new Set();
    function expand(packageName) {
        var _a;
        if (packages.has(packageName) && !relateds.has(packageName)) {
            // 当前包加入相关包列表
            relateds.add(packageName);
            // 依赖此包的包加入相关包列表
            const packageUsedBy = (_a = dependencies.get(packageName)) === null || _a === void 0 ? void 0 : _a.usedBy;
            if (packageUsedBy) {
                for (const usedByPackage of packageUsedBy.keys())
                    expand(usedByPackage);
            }
        }
    }
    packageNames.forEach(expand);
    return relateds;
}
/**
 * 计算待发布各包的发布顺序和发布版本号
 */
const semVerMap = { major: 2, minor: 1, patch: 0 };
function computePublishQueue(packages2publish, entries, packages, dependencies) {
    const computed = new Map();
    function compute(packageName) {
        var _a, _b;
        if (computed.has(packageName))
            return;
        const pkg = packages.get(packageName);
        const dependenciesWillPublish = [...(_b = (_a = dependencies.get(packageName)) === null || _a === void 0 ? void 0 : _a.dependencies.keys()) !== null && _b !== void 0 ? _b : []]
            .filter(name => packages2publish.has(name));
        let weights = 1;
        let semVerLevel = 'patch';
        dependenciesWillPublish.forEach(dependencyPackageName => {
            if (!computed.has(dependencyPackageName))
                compute(dependencyPackageName);
            const dependencyRecord = computed.get(dependencyPackageName);
            weights += dependencyRecord.weights;
            const dependencyVersion = pkg.dependencies.get(dependencyPackageName);
            const diff = dependencyRecord.version.diff(dependencyVersion);
            if (diff.diff === 1 && semVerMap[diff.level] > semVerMap[semVerLevel])
                semVerLevel = diff.level;
        });
        const newVersion = pkg.version.update(entries.has(pkg.name) ? entries.get(pkg.name) : semVerLevel // entry 包的 semVerLevel 通过外界传入，不通过计算获得
        );
        computed.set(packageName, { name: packageName, weights, version: newVersion });
    }
    packages2publish.forEach(compute);
    // 按更新顺序对包列表进行排序
    const sorted = new Map([...computed.values()].sort((a, b) => a.weights - b.weights)
        .map(r => [r.name, r]));
    // 生成最终的队列
    return new Map([...sorted.values()].map(({ name: packageName, version: newVersion }) => {
        var _a;
        const pkg = packages.get(packageName);
        const prevVersion = pkg.version;
        const depRecords = [];
        for (const [depName, depPrevVersion] of pkg.dependencies) {
            const depNewVersion = (_a = sorted.get(depName)) === null || _a === void 0 ? void 0 : _a.version;
            if (!depNewVersion)
                continue;
            depRecords.push({ name: depName, prevVersion: depPrevVersion, newVersion: depNewVersion });
        }
        return [packageName, { name: packageName, prevVersion, newVersion, dependencies: depRecords }];
    }));
}
