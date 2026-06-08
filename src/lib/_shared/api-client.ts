export type ApiResponse<T> = { data?: T; error?: string };

type ReqOpts = { headers?: Record<string, string> };

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: ReqOpts,
): Promise<T> => {
  const res = await fetch(path, {
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
