export type ApiResponse<T> = { data?: T; error?: string };

type ReqOpts = { headers?: Record<string, string> };

// Base URL absoluta para la SPA del portero (Vite + Capacitor): el código
// compartido llama a rutas relativas (`/api/...`); si `globalThis.__API_BASE__`
// está definido (lo setea la SPA al arrancar), se prefija al backend remoto. En
// Next queda sin definir → rutas relativas igual que siempre (no invasivo).
export const resolveUrl = (path: string): string => {
  if (/^https?:\/\//.test(path)) return path;
  const base = (globalThis as { __API_BASE__?: string }).__API_BASE__;
  return base ? base.replace(/\/$/, "") + path : path;
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: ReqOpts,
): Promise<T> => {
  const res = await fetch(resolveUrl(path), {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(opts?.headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const payload = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || payload.error) {
    throw new Error(payload.error ?? `HTTP ${res.status}`);
  }
  return payload.data as T;
};

export const api = {
  get: <T>(path: string, opts?: ReqOpts) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: ReqOpts) => request<T>("POST", path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: ReqOpts) => request<T>("PUT", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: ReqOpts) => request<T>("PATCH", path, body, opts),
  del: <T>(path: string, body?: unknown, opts?: ReqOpts) => request<T>("DELETE", path, body, opts),
};
