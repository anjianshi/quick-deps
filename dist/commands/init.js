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
const quick_args_1 = require("quick-args");
const packages_1 = require("../lib/packages");
exports.default = new quick_args_1.Command({
    name: 'init',
    describe: "Mark current directory as packages root.",
    handler: initHandler
});
function initHandler() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const dirpath = process.cwd();
            packages_1.markRoot(dirpath);
            console.log('Marked!');
        }
        catch (e) {
            console.error(e);
        }
    });
}
