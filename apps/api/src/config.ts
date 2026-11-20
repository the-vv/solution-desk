export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  publicUrl: string;
  uploadDir: string;
  maxUploadBytes: number;
  secureCookies: boolean;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function loadConfig(): AppConfig {
  const publicUrl = required('PUBLIC_URL').replace(/\/+$/, '');
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return {
    port: Number(process.env['PORT'] ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret,
    googleClientId: required('GOOGLE_CLIENT_ID'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    publicUrl,
    uploadDir: process.env['UPLOAD_DIR'] ?? '/data/uploads',
    maxUploadBytes: 25 * 1024 * 1024,
    secureCookies: publicUrl.startsWith('https://'),
  };
}

export const CONFIG = Symbol('CONFIG');
