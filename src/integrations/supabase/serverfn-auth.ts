/**
 * Installs a global fetch interceptor (browser only) that attaches the
 * current Supabase access token as an Authorization header to all
 * TanStack `_serverFn` requests, so server functions guarded by
 * `requireSupabaseAuth` middleware can identify the caller.
 */
import { supabase } from "./client";

let installed = false;

export function installServerFnAuth() {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : "";

      if (url.includes("/_serverFn/")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(
            (init?.headers as HeadersInit | undefined) ??
              (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          if (input instanceof Request) {
            return originalFetch(new Request(input, { headers }));
          }
          return originalFetch(input, { ...(init ?? {}), headers });
        }
      }
    } catch (err) {
      console.error("[serverfn-auth] interceptor failed:", err);
    }
    return originalFetch(input, init);
  };
}
