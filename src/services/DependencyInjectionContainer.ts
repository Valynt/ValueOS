/**
 * Dependency Injection Container
 *
 * Provides centralized dependency management and service resolution
 * with support for singleton, transient, and scoped lifetimes.
 */

import { logger } from "../lib/logger";

export interface ServiceLifetime {
  Singleton: "singleton";
  Transient: "transient";
  Scoped: "scoped";
}

export const Lifetime: ServiceLifetime = {
  Singleton: "singleton",
  Transient: "transient",
  Scoped: "scoped",
};

export interface ServiceDescriptor<T = any> {
  token: string | symbol;
  implementation: new (...args: any[]) => T | (() => T);
  lifetime: keyof ServiceLifetime;
  dependencies?: (string | symbol)[];
  factory?: (...deps: any[]) => T;
}

export interface IServiceProvider {
  get<T>(token: string | symbol): T;
  getAll<T>(token: string | symbol): T[];
  has(token: string | symbol): boolean;
  createScope(): IServiceProvider;
}

export interface IServiceCollection {
  addSingleton<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T | (() => T),
    dependencies?: (string | symbol)[]
  ): IServiceCollection;

  addTransient<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T | (() => T),
    dependencies?: (string | symbol)[]
  ): IServiceCollection;

  addScoped<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T | (() => T),
    dependencies?: (string | symbol)[]
  ): IServiceCollection;

  addFactory<T>(
    token: string | symbol,
    factory: (...deps: any[]) => T,
    lifetime: keyof ServiceLifetime,
    dependencies?: (string | symbol)[]
  ): IServiceCollection;

  build(): IServiceProvider;
}

export class ServiceCollection implements IServiceCollection {
  private services = new Map<string | symbol, ServiceDescriptor>();

  addSingleton<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T | (() => T),
    dependencies?: (string | symbol)[]
  ): IServiceCollection {
    this.services.set(token, {
      token,
      implementation,
      lifetime: "Singleton",
      dependencies,
    });
    return this;
  }

  addTransient<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T | (() => T),
    dependencies?: (string | symbol)[]
  ): IServiceCollection {
    this.services.set(token, {
      token,
      implementation,
      lifetime: "Transient",
      dependencies,
    });
    return this;
  }

  addScoped<T>(
    token: string | symbol,
    implementation: new (...args: any[]) => T | (() => T),
    dependencies?: (string | symbol)[]
  ): IServiceCollection {
    this.services.set(token, {
      token,
      implementation,
      lifetime: "Scoped",
      dependencies,
    });
    return this;
  }

  addFactory<T>(
    token: string | symbol,
    factory: (...deps: any[]) => T,
    lifetime: keyof ServiceLifetime,
    dependencies?: (string | symbol)[]
  ): IServiceCollection {
    this.services.set(token, {
      token,
      implementation: factory,
      lifetime,
      dependencies,
      factory,
    });
    return this;
  }

  build(): IServiceProvider {
    return new ServiceProvider(this.services);
  }
}

export class ServiceProvider implements IServiceProvider {
  private singletons = new Map<string | symbol, any>();
  private scopedInstances = new Map<string | symbol, any>();
  private services: Map<string | symbol, ServiceDescriptor>;

  constructor(services: Map<string | symbol, ServiceDescriptor>) {
    this.services = services;
  }

  get<T>(token: string | symbol): T {
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${String(token)}`);
    }

    switch (descriptor.lifetime) {
      case "Singleton":
        return this.getSingleton<T>(descriptor);
      case "Transient":
        return this.getTransient<T>(descriptor);
      case "Scoped":
        return this.getScoped<T>(descriptor);
      default:
        throw new Error(`Unknown lifetime: ${descriptor.lifetime}`);
    }
  }

  getAll<T>(token: string | symbol): T[] {
    // For now, just return single instance
    // Could be extended to support multiple registrations
    if (this.services.has(token)) {
      return [this.get<T>(token)];
    }
    return [];
  }

  has(token: string | symbol): boolean {
    return this.services.has(token);
  }

  createScope(): IServiceProvider {
    const scopedProvider = new ServiceProvider(this.services);
    // Clear scoped instances for new scope
    scopedProvider.scopedInstances = new Map();
    return scopedProvider;
  }

  private getSingleton<T>(descriptor: ServiceDescriptor): T {
    if (this.singletons.has(descriptor.token)) {
      return this.singletons.get(descriptor.token);
    }

    const instance = this.createInstance<T>(descriptor);
    this.singletons.set(descriptor.token, instance);
    return instance;
  }

  private getTransient<T>(descriptor: ServiceDescriptor): T {
    return this.createInstance<T>(descriptor);
  }

  private getScoped<T>(descriptor: ServiceDescriptor): T {
    if (this.scopedInstances.has(descriptor.token)) {
      return this.scopedInstances.get(descriptor.token);
    }

    const instance = this.createInstance<T>(descriptor);
    this.scopedInstances.set(descriptor.token, instance);
    return instance;
  }

  private createInstance<T>(descriptor: ServiceDescriptor): T {
    try {
      if (descriptor.factory) {
        // Use factory function
        const deps = this.resolveDependencies(descriptor.dependencies || []);
        return descriptor.factory(...deps);
      }

      // Use constructor
      const Constructor = descriptor.implementation as new (
        ...args: any[]
      ) => T;
      const deps = this.resolveDependencies(descriptor.dependencies || []);

      if (deps.length > 0) {
        return new Constructor(...deps);
      } else {
        return new Constructor();
      }
    } catch (error) {
      logger.error(
        `Failed to create instance for ${String(descriptor.token)}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  private resolveDependencies(dependencies: (string | symbol)[]): any[] {
    return dependencies.map((dep) => this.get(dep));
  }
}

// Global service collection and provider
let globalServiceCollection: ServiceCollection | null = null;
let globalServiceProvider: ServiceProvider | null = null;

export function createServiceCollection(): IServiceCollection {
  globalServiceCollection = new ServiceCollection();
  return globalServiceCollection;
}

export function getServiceProvider(): IServiceProvider {
  if (!globalServiceProvider && globalServiceCollection) {
    globalServiceProvider = globalServiceCollection.build() as ServiceProvider;
  }
  return globalServiceProvider!;
}

export function getService<T>(token: string | symbol): T {
  const provider = getServiceProvider();
  return provider.get<T>(token);
}

export function getServices<T>(token: string | symbol): T[] {
  const provider = getServiceProvider();
  return provider.getAll<T>(token);
}

export function hasService(token: string | symbol): boolean {
  const provider = getServiceProvider();
  return provider.has(token);
}

// Service tokens for common services
export const SERVICE_TOKENS = {
  // Core services
  LOGGER: Symbol("Logger"),
  AUDIT_LOGGER: Symbol("AuditLogger"),
  CACHE: Symbol("Cache"),

  // Agent services
  AGENT_REGISTRY: Symbol("AgentRegistry"),
  AGENT_API: Symbol("AgentAPI"),
  MESSAGE_QUEUE: Symbol("MessageQueue"),

  // Infrastructure
  DATABASE: Symbol("Database"),
  REDIS: Symbol("Redis"),

  // Business services
  UNIFIED_ORCHESTRATOR: Symbol("UnifiedOrchestrator"),
  LLM_GATEWAY: Symbol("LLMGateway"),
  MEMORY_SYSTEM: Symbol("MemorySystem"),
} as const;
