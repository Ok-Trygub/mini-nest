"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inject = void 0;
const tokens_1 = require("../tokens");
const Inject = (token) => {
    return (target, _propertyKey, parameterIndex) => {
        const tokens = Reflect.getOwnMetadata(tokens_1.INJECT_TOKENS_KEY, target) ?? {};
        tokens[parameterIndex] = token;
        Reflect.defineMetadata(tokens_1.INJECT_TOKENS_KEY, tokens, target);
    };
};
exports.Inject = Inject;
