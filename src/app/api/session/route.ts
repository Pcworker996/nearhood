import { authClient, contributorIdentity, rejectCrossOrigin } from "@/lib/auth";
import { database } from "@/lib/database";
import { publicFailure } from "@/lib/http";

export async function GET() {
  try {
    const identity = await contributorIdentity();
    const profile = identity
      ? await database().query(
          "SELECT display_name FROM nearhood.contributors WHERE id=$1",
          [identity.id],
        )
      : null;
    return Response.json(
      {
        signedIn: !!identity,
        displayName: profile?.rows[0]?.display_name ?? "",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return publicFailure(error);
  }
}

export async function DELETE(request: Request) {
  if (rejectCrossOrigin(request))
    return Response.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  const client = await authClient();
  if (client) await client.auth.signOut();
  return Response.json(
    { signedIn: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
