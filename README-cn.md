# quick-deps: 快捷的 npm 包依赖管理工具

在一个文件夹下维护一系列互相依赖的 npm 包，是一件繁琐的事情。
某个包升级后，依赖它的包也都要跟着升级。

`lerna` 是完成此任务的一个常用工具，但它有较多的“预设要求”，用起来不够方便。   
例如它要求执行 `lerna publish` 前必须提交 git，等等...

此工具则只专注于 npm 包之间的依赖管理，不对其他任何东西加以限制。


## 使用方式
先全局安装 `quick-deps` 包。然后在文件夹下执行 `deps` 的相关命令。
```sh
npm install --global quick-deps

cd my-packages
deps publish xxx      # 指定包发布新版本（同时也会更新相关包的依赖列表并发布新版）
deps sync             # 保证互相依赖的各包都依赖的是最新的版本（有必要时会对一些包发布新版）
...
```


## 约定

### 目录结构
目前仅支持以下目录结构：
```js
packages-root/
  package-A/
    package.json
  package-B/
    package.json
  ...
```

## 依赖管理
- 此工具只负责维护 `packages root` 下各 package 之间的依赖关系，不处理外部依赖。
- 此工具约定各 package 之间永远都只依赖最新版本，不允许出现循环依赖
- 此工具约定 package 的 version 为 semver 格式，且各段落都只包含数字（例如不支持 1.1.0-alpha 这种版本号）
