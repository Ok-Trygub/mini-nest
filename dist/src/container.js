"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Container = exports.CircularDependencyError = void 0;
const tokens_1 = require("./tokens");
class CircularDependencyError extends Error {
    constructor(chain) {
        super(`Circular dependency detected: ${chain.join(' -> ')}`);
        this.name = 'CircularDependencyError';
    }
}
exports.CircularDependencyError = CircularDependencyError;
class Container {
    singletons = new Map();
    tokenValues = new Map();
    register(token, value) {
        this.tokenValues.set(token, value);
    }
    resolve(target) {
        return this.resolveClass(target, []);
    }
    resolveClass(target, path) {
        const metadata = Reflect.getMetadata(tokens_1.INJECTABLE_KEY, target);
        if (!metadata) {
            throw new Error(`Class ${target.name} is not marked with @Injectable(), the container cannot construct it`);
        }
        if (metadata.scope === 'singleton' && this.singletons.has(target)) {
            return this.singletons.get(target);
        }
        if (path.includes(target)) {
            const chain = [...path, target].map((item) => item.name);
            throw new CircularDependencyError(chain);
        }
        const paramTypes = (Reflect.getMetadata('design:paramtypes', target) ??
            []);
        const injectTokens = (Reflect.getOwnMetadata(tokens_1.INJECT_TOKENS_KEY, target) ??
            {});
        const dependencies = paramTypes.map((paramType, index) => {
            const token = injectTokens[index];
            if (token !== undefined) {
                return this.resolveToken(token, target, index);
            }
            if (paramType === Object) {
                throw new Error(`Cannot resolve parameter #${index} of ${target.name}: ` +
                    `its type is erased to Object at runtime (interface or primitive), use @Inject(token)`);
            }
            return this.resolveClass(paramType, [...path, target]);
        });
        const instance = new target(...dependencies);
        if (metadata.scope === 'singleton') {
            this.singletons.set(target, instance);
        }
        return instance;
    }
    resolveToken(token, owner, index) {
        if (!this.tokenValues.has(token)) {
            throw new Error(`No value registered for token ${String(token)} (parameter #${index} of ${owner.name})`);
        }
        return this.tokenValues.get(token);
    }
}
exports.Container = Container;
