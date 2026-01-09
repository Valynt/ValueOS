type EnvRecord = NodeJS.ProcessEnv;

const envSource: EnvRecord = process.env;

export const configEnv = {
  get: (key: string, fallback?: string): string | undefined =>
    envSource[key] ?? fallback,
};

export const getDatabaseUrl = (): string | undefined =>
  configEnv.get('DATABASE_URL');
