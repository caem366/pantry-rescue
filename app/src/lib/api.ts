const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${baseUrl}${path}`;
}

export const apiFetch: typeof fetch = (path, init) => fetch(apiUrl(String(path)), {
  credentials: "include",
  ...init,
});
