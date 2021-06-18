#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const quick_args_1 = require("quick-args");
const version_1 = require("./commands/version");
const publish_1 = require("./commands/publish");
quick_args_1.default
    .program('deps')
    .describe('Simple dependencies manage.')
    .command(version_1.default)
    .command(publish_1.default)
    .parse();
