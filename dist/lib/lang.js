"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmpty = exports.execute = exports.isSamePath = exports.fileExists = void 0;
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const logging_1 = require("./logging");
/**
 * Check if the target file exists, and is a file
 */
function fileExists(filepath) {
    return new Promise(resolve => {
        fs.stat(filepath, (err, stat) => {
            resolve(!err && stat.isFile());
        });
    });
}
exports.fileExists = fileExists;
/**
 * 判断两个字符串是否是同一个路径
 */
function isSamePath(a, b) {
    return path.resolve(a) === path.resolve(b);
}
exports.isSamePath = isSamePath;
/**
 * Execute shell command
 *
 * - resolve(): execution succeed
 * - reject(err): execution failed
 */
function execute(command, options) {
    return new Promise((resolve, reject) => {
        logging_1.default(options.cwd ? `Execute: \`${command}\` at ${options.cwd}` : `Execute: \`${command}\``);
        const proc = childProcess.spawn(command, Object.assign({ shell: true, stdio: 'inherit' }, options));
        proc.on('error', reject);
        proc.on('exit', code => {
            if (code !== 0)
                reject(new Error(`Command execute failed: ${code}`));
            else
                resolve();
        });
    });
}
exports.execute = execute;
/**
 * 判断一个对象是否为空
 */
function isEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
}
exports.isEmpty = isEmpty;
