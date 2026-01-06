export interface ConsulModuleOptions {
  /**
   * Nom du service à enregistrer dans Consul
   */
  serviceName: string;

  /**
   * Port du service
   */
  servicePort: number;

  /**
   * Hôte du service (défaut: host.docker.internal)
   */
  serviceHost?: string;

  /**
   * Chemin du health check (défaut: /health)
   */
  healthCheckPath?: string;

  /**
   * Intervalle des health checks (défaut: 10s)
   */
  healthCheckInterval?: string;

  /**
   * Timeout des health checks (défaut: 5s)
   */
  healthCheckTimeout?: string;

  /**
   * Hôte de Consul (défaut: localhost)
   */
  consulHost?: string;

  /**
   * Port de Consul (défaut: 8500)
   */
  consulPort?: string;

  /**
   * Tags Consul optionnels
   */
  tags?: string[];

  /**
   * Métadonnées optionnelles
   */
  meta?: Record<string, string>;
}
