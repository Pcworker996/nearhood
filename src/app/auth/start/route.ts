import { authClient, requestOrigin } from "@/lib/auth";

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const client = await authClient();
  if (!client)
    return Response.redirect(
      new URL("/?contribute=1&auth=unavailable", origin),
    );
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", origin).href,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url)
    return Response.redirect(new URL("/?contribute=1&auth=failed", origin));
  return new Response(null, {
    status: 303,
    headers: { Location: data.url, "Cache-Control": "no-store" },
  });
}
