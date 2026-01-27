// packages/backend/src/api/config/environment.ts
export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  isProduction: boolean;
  isDevelopment: boolean;
}

export const environmentConfig: EnvironmentConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};