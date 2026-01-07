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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsulDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const Consul = require("consul");
const consul_constants_1 = require("./consul.constants");
let ConsulDiscoveryService = class ConsulDiscoveryService {
    constructor(options) {
        this.options = options;
        this.consul = new Consul({
            host: options.consulHost || 'localhost',
            port: String(options.consulPort || '8500'),
        });
    }
    async getServiceInstances(serviceName) {
        try {
            const services = await this.consul.health.service({
                service: serviceName,
                passing: true,
            });
            return services.map(s => ({
                host: s.Service.Address,
                port: s.Service.Port,
            }));
        }
        catch (error) {
            console.error(`❌ [Consul Discovery] Error finding service ${serviceName}:`, error);
            throw error;
        }
    }
    async getServiceUrl(serviceName) {
        const instances = await this.getServiceInstances(serviceName);
        if (instances.length === 0) {
            throw new Error(`Service ${serviceName} not found in Consul`);
        }
        const instance = instances[0];
        const url = `http://${instance.host}:${instance.port}`;
        console.log(`🔍 [Consul Discovery] Found ${serviceName} at ${url}`);
        return url;
    }
};
exports.ConsulDiscoveryService = ConsulDiscoveryService;
exports.ConsulDiscoveryService = ConsulDiscoveryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(consul_constants_1.CONSUL_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], ConsulDiscoveryService);
//# sourceMappingURL=consul-discovery.service.js.map