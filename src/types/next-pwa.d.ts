// next-pwa no publica tipos y rompe `next build` (tsc). Declaración mínima para
// destrabar la compilación; el plugin se usa solo en next.config.ts.
declare module "next-pwa" {
  import type { NextConfig } from "next";
  type PWAOptions = {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    buildExcludes?: Array<string | RegExp>;
    [key: string]: unknown;
  };
  export default function withPWAInit(
    options?: PWAOptions,
  ): (config: NextConfig) => NextConfig;
}
