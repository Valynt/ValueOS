// Type declarations for external modules without type definitions

declare module "@aws-sdk/client-secrets-manager" {
  export class SecretsManagerClient {
    constructor(config?: Record<string, unknown>);
    send(command: unknown): Promise<unknown>;
  }
  export class GetSecretValueCommand {
    constructor(input: { SecretId: string });
  }
  export class CreateSecretCommand {
    constructor(input: { Name: string; SecretString: string });
  }
  export class UpdateSecretCommand {
    constructor(input: { SecretId: string; SecretString: string });
  }
}

declare module "@valueos/business-case" {
  export interface BusinessCase {
    id: string;
    name: string;
    [key: string]: unknown;
  }
  export function createBusinessCase(data: unknown): BusinessCase;
}

declare module "@valueos/templates" {
  export interface Template {
    id: string;
    name: string;
    [key: string]: unknown;
  }
}

declare module "@valueos/mcp-ground-truth" {
  export interface GroundTruth {
    [key: string]: unknown;
  }
}

declare module "swagger-ui-express" {
  import type { RequestHandler } from "express";
  export function setup(spec: unknown, opts?: unknown): RequestHandler;
  export function serve(req: unknown, res: unknown, next: unknown): void;
}

declare module "yamljs" {
  export function load(path: string): unknown;
  export function parse(yaml: string): unknown;
  export function stringify(obj: unknown, depth?: number): string;
}

declare module "storybook/test" {
  export const fn: (...args: unknown[]) => unknown;
  export const expect: unknown;
}

declare module "@storybook/react" {
  export interface Meta<T = unknown> {
    title?: string;
    component?: T;
    [key: string]: unknown;
  }
  export interface StoryObj<T = unknown> {
    args?: Partial<T>;
    [key: string]: unknown;
  }
}

declare module "@storybook/react-vite" {
  export interface StorybookConfig {
    stories: string[];
    addons?: string[];
    framework?: unknown;
    [key: string]: unknown;
  }
}
