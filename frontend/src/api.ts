const TOKEN_KEY = "bn_access_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/** Build `?key=value` for GET APIs; drops empty / undefined / null. */
export function withQuery(path: string, params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    u.set(key, String(value));
  }
  const q = u.toString();
  return q ? `${path}?${q}` : path;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let userMessage = text || res.statusText;
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (typeof body.detail === "string") {
        userMessage = body.detail;
      } else if (Array.isArray(body.detail)) {
        const parts = body.detail
          .map((item: unknown) =>
            typeof item === "object" && item !== null && "msg" in item
              ? String((item as { msg: string }).msg)
              : "",
          )
          .filter(Boolean);
        if (parts.length) userMessage = parts.join("; ");
      }
    } catch {
      /* leave userMessage as raw body */
    }
    throw new Error(userMessage.trim() || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
