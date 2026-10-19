import { authClient, requestOrigin } from "@/lib/auth";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const client = await authClient();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return Response.redirect(
        new URL("/?contribute=1", requestOrigin(request)),
        303,
      );
  }
  return Response.redirect(
    new URL("/?contribute=1&auth=failed", requestOrigin(request)),
    303,
  );
}
