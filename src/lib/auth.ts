import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ORIGIN
        ? new URL(process.env.APP_ORIGIN).protocol === "https:"
        : process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
}

// Only a remotely verified Google identity can contribute. Cookie contents and
// user-editable metadata are never authorization evidence.
export async function contributorIdentity() {
  const client = await authClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (
    error ||
    !data.user ||
    !data.user.app_metadata.providers?.includes("google")
  )
    return null;
  return { id: data.user.id };
}

export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    (origin && origin !== requestOrigin(request)) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  );
}

export function requestOrigin(request: Request) {
  if (process.env.APP_ORIGIN) return new URL(process.env.APP_ORIGIN).origin;
  const url = new URL(request.url);
  // Next dev may use localhost in request.url even for a 127.0.0.1 request.
  // Preserve the actual host so PKCE cookies and local draft storage stay on
  // the same origin. Production should configure its canonical APP_ORIGIN.
  url.host = request.headers.get("host") ?? url.host;
  return url.origin;
}
