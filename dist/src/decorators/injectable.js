"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Injectable = void 0;
const tokens_1 = require("../tokens");
const Injectable = (options = {}) => {
    return (target) => {
        const metadata = { scope: options.scope ?? 'singleton' };
        Reflect.defineMetadata(tokens_1.INJECTABLE_KEY, metadata, target);
    };
};
exports.Injectable = Injectable;
