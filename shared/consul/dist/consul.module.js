"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ConsulModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsulModule = void 0;
const common_1 = require("@nestjs/common");
const consul_service_1 = require("./consul.service");
const consul_discovery_service_1 = require("./consul-discovery.service");
const consul_constants_1 = require("./consul.constants");
let ConsulModule = ConsulModule_1 = class ConsulModule {
    static register(options) {
        return {
            module: ConsulModule_1,
            providers: [
                {
                    provide: consul_constants_1.CONSUL_OPTIONS,
                    useValue: options,
                },
                consul_service_1.ConsulService,
                consul_discovery_service_1.ConsulDiscoveryService,
            ],
            exports: [consul_service_1.ConsulService, consul_discovery_service_1.ConsulDiscoveryService],
            global: false,
        };
    }
    static registerAsync(options) {
        return {
            module: ConsulModule_1,
            providers: [
                {
                    provide: consul_constants_1.CONSUL_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                consul_service_1.ConsulService,
            ],
            exports: [consul_service_1.ConsulService],
            global: false,
        };
    }
};
exports.ConsulModule = ConsulModule;
exports.ConsulModule = ConsulModule = ConsulModule_1 = __decorate([
    (0, common_1.Module)({})
], ConsulModule);
//# sourceMappingURL=consul.module.js.map