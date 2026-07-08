import { Redis } from "@upstash/redis";

// Cliente Redis (Upstash) compartido — singleton a nivel de módulo para
// reusar conexión entre invocaciones serverless. `null` si las envs no están
// seteadas (dev sin Upstash configurado); los callers deciden cómo degradar.
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash ? Redis.fromEnv() : null;

export const getRedis = (): Redis | null => redis;
