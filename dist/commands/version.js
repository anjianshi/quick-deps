"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const quick_args_1 = require("quick-args");
exports.default = new quick_args_1.Command({
    name: 'version',
    describe: "show this tool's version",
    handler() {
        const packageJSON = path.resolve(__dirname, '../../package.json');
        const raw = fs.readFileSync(packageJSON).toString();
        const data = JSON.parse(raw);
        console.log(data.version);
    }
});
