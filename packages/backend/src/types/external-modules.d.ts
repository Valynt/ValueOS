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

declare module "node-fetch" {
  const fetch: typeof globalThis.fetch;
  export default fetch;
  export { fetch };
}

declare module "supertest" {
  import type { Express } from "express";
  function supertest(app: Express | unknown): supertest.SuperTest<supertest.Test>;
  namespace supertest {
    interface Test extends Promise<Response> {
      get(url: string): Test;
      post(url: string): Test;
      put(url: string): Test;
      delete(url: string): Test;
      patch(url: string): Test;
      set(field: string, val: string): Test;
      send(data: unknown): Test;
      expect(status: number): Test;
      expect(status: number, body: unknown): Test;
      expect(checker: (res: Response) => void): Test;
      query(params: Record<string, string>): Test;
      auth(user: string, pass: string): Test;
    }
    interface SuperTest<T> {
      get(url: string): T;
      post(url: string): T;
      put(url: string): T;
      delete(url: string): T;
      patch(url: string): T;
    }
    interface Response {
      status: number;
      body: unknown;
      text: string;
      headers: Record<string, string>;
    }
  }
  export = supertest;
}
