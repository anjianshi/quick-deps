"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readdir = exports.isEmpty = exports.execute = exports.isSamePath = exports.fileExists = void 0;
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
 * Detect if two string target's to the same path
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
 * Detect if an object is empty
 */
function isEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
}
exports.isEmpty = isEmpty;
function readdir(dirpath, withFileTypes = false) {
    return new Promise((resolve, reject) => {
        fs.readdir(dirpath, { withFileTypes: withFileTypes }, (err, items) => __awaiter(this, void 0, void 0, function* () {
            if (err)
                return reject(err);
            resolve(items);
        }));
    });
}
exports.readdir = readdir;
