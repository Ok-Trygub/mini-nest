"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const container_1 = require("../src/container");
const inject_1 = require("../src/decorators/inject");
const injectable_1 = require("../src/decorators/injectable");
const tokens_1 = require("../src/tokens");
(0, node_test_1.describe)('Container', () => {
    (0, node_test_1.it)('resolves a simple graph recursively (A -> B -> C)', () => {
        let C = class C {
            value = 'from-C';
        };
        C = __decorate([
            (0, injectable_1.Injectable)()
        ], C);
        let B = class B {
            c;
            constructor(c) {
                this.c = c;
            }
        };
        B = __decorate([
            (0, injectable_1.Injectable)(),
            __metadata("design:paramtypes", [C])
        ], B);
        let A = class A {
            b;
            constructor(b) {
                this.b = b;
            }
        };
        A = __decorate([
            (0, injectable_1.Injectable)(),
            __metadata("design:paramtypes", [B])
        ], A);
        const container = new container_1.Container();
        const a = container.resolve(A);
        strict_1.default.ok(a instanceof A);
        strict_1.default.ok(a.b instanceof B);
        strict_1.default.ok(a.b.c instanceof C);
        strict_1.default.equal(a.b.c.value, 'from-C');
    });
    (0, node_test_1.it)('returns the same instance for singleton scope (default)', () => {
        let Service = class Service {
        };
        Service = __decorate([
            (0, injectable_1.Injectable)()
        ], Service);
        const container = new container_1.Container();
        strict_1.default.equal(container.resolve(Service), container.resolve(Service));
    });
    (0, node_test_1.it)('returns a new instance on every resolve for transient scope', () => {
        let Service = class Service {
        };
        Service = __decorate([
            (0, injectable_1.Injectable)({ scope: 'transient' })
        ], Service);
        const container = new container_1.Container();
        strict_1.default.notEqual(container.resolve(Service), container.resolve(Service));
    });
    (0, node_test_1.it)('resolves a dependency by explicit token via @Inject', () => {
        let NeedsConfig = class NeedsConfig {
            config;
            constructor(config) {
                this.config = config;
            }
        };
        NeedsConfig = __decorate([
            (0, injectable_1.Injectable)(),
            __param(0, (0, inject_1.Inject)(tokens_1.CONFIG)),
            __metadata("design:paramtypes", [Object])
        ], NeedsConfig);
        const container = new container_1.Container();
        const configValue = { url: 'http://localhost' };
        container.register(tokens_1.CONFIG, configValue);
        const instance = container.resolve(NeedsConfig);
        strict_1.default.equal(instance.config, configValue);
    });
    (0, node_test_1.it)('throws a descriptive error (not RangeError) for a circular graph A -> B -> A', () => {
        let A = class A {
        };
        A = __decorate([
            (0, injectable_1.Injectable)()
        ], A);
        let B = class B {
        };
        B = __decorate([
            (0, injectable_1.Injectable)()
        ], B);
        Reflect.defineMetadata('design:paramtypes', [B], A);
        Reflect.defineMetadata('design:paramtypes', [A], B);
        const container = new container_1.Container();
        strict_1.default.throws(() => container.resolve(A), (error) => {
            strict_1.default.ok(error instanceof container_1.CircularDependencyError);
            strict_1.default.ok(!(error instanceof RangeError));
            strict_1.default.match(error.message, /A -> B -> A/);
            return true;
        });
    });
});
