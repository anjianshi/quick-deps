/// <reference types="node" />
import * as childProcess from 'child_process';
/**
 * Check if the target file exists, and is a file
 */
export declare function fileExists(filepath: string): Promise<boolean>;
/**
 * 判断两个字符串是否是同一个路径
 */
export declare function isSamePath(a: string, b: string): boolean;
/**
 * Execute shell command
 *
 * - resolve(): execution succeed
 * - reject(err): execution failed
 */
export declare function execute(command: string, options: childProcess.SpawnOptions): Promise<void>;
