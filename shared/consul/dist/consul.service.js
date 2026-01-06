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
exports.ConsulService = void 0;
const common_1 = require("@nestjs/common");
const Consul = require("consul");
const consul_constants_1 = require("./consul.constants");
let ConsulService = class ConsulService {
    constructor(options) {
        this.options = options;
        this.consul = new Consul({
            host: options.consulHost || process.env.CONSUL_HOST || 'localhost',
            port: options.consulPort || process.env.CONSUL_PORT || '8500',
        });
    }
    async onModuleInit() {
        const serviceName = this.options.serviceName;
        const servicePort = this.options.servicePort;
        const serviceHost = this.options.serviceHost || 'host.docker.internal';
        const healthCheckPath = this.options.healthCheckPath || '/health';
        this.serviceId = `${serviceName}-${servicePort}`;
        console.log(`📝 [Consul] Registering service: ${this.serviceId}`);
        await this.consul.agent.service.register({
            id: this.serviceId,
            name: serviceName,
            address: serviceHost,
            port: servicePort,
            tags: this.options.tags || [],
            meta: this.options.meta || {},
            check: {
                http: `http://${serviceHost}:${servicePort}${healthCheckPath}`,
                interval: this.options.healthCheckInterval || '10s',
            },
        });
        console.log(`✅ [Consul] Service registered successfully: ${this.serviceId}`);
    }
    async onModuleDestroy() {
        console.log(`📤 [Consul] Deregistering service: ${this.serviceId}`);
        try {
            await this.consul.agent.service.deregister(this.serviceId);
            console.log(`✅ [Consul] Service deregistered: ${this.serviceId}`);
        }
        catch (error) {
            console.error(`❌ [Consul] Error deregistering service:`, error);
        }
    }
    async getServiceInstances(serviceName) {
        const services = await this.consul.health.service({
            service: serviceName,
            passing: true,
        });
        return services.map((s) => ({
            host: s.Service.Address,
            port: s.Service.Port,
        }));
    }
    async getServiceUrl(serviceName) {
        const instances = await this.getServiceInstances(serviceName);
        if (instances.length === 0) {
            throw new Error(`Service ${serviceName} not found in Consul or all instances are unhealthy`);
        }
        const instance = instances[0];
        return `http://${instance.host}:${instance.port}`;
    }
};
exports.ConsulService = ConsulService;
exports.ConsulService = ConsulService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(consul_constants_1.CONSUL_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], ConsulService);
//# sourceMappingURL=consul.service.js.map