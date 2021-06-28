/// <reference types="node" />
import * as childProcess from 'child_process';
/**
 * Check if the target file exists, and is a file
 */
export declare function fileExists(filepath: string): Promise<boolean>;
/**
 * Detect if two string target's to the same path
 */
export declare function isSamePath(a: string, b: string): boolean;
/**
 * Execute shell command
 *
 * - resolve(): execution succeed
 * - reject(err): execution failed
 */
export declare function execute(command: string, options: childProcess.SpawnOptions): Promise<void>;
/**
 * Detect if an object is empty
 */
export declare function isEmpty<O extends {
    [key: string]: any;
}>(obj?: O): boolean;
