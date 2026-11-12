import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function removeFolder(
  admin: ReturnType<typeof createServiceClient>,
  bucket: string,
  prefix: string
) {
  // Storage list is one level deep; recurse into sub-folders (listing-photos/<uid>/<listing>/<file>).
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  const files: string[] = [];
  for (const item of data || []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) await removeFolder(admin, bucket, path);
    else files.push(path);
  }
  if (files.length) {
    const { error: rmErr } = await admin.storage.from(bucket).remove(files);
    if (rmErr) throw rmErr;
  }
}

/** Deletes the signed-in user only. The user id always comes from the session, never the request. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const admin = createServiceClient();
  const uid = user.id;

  const { error: prepErr } = await admin.rpc("prepare_account_deletion", { p_user: uid });
  if (prepErr) {
    if (prepErr.message.includes("last_admin")) {
      return NextResponse.json(
        { error: "You're the only admin. Make someone else an admin before deleting your account." },
        { status: 409 }
      );
    }
    console.error("prepare_account_deletion failed", prepErr.message);
    return NextResponse.json({ error: "Couldn't delete your account. Please try again." }, { status: 500 });
  }

  try {
    // Photos for every listing they own (paths are <uid>/... but also cover any stored path).
    const { data: photos } = await admin
      .from("listing_photos")
      .select("storage_path, listings!inner(poster_id)")
      .eq("listings.poster_id", uid);
    const paths = (photos || []).map((p) => p.storage_path).filter(Boolean) as string[];
    if (paths.length) await admin.storage.from("listing-photos").remove(paths);
    await removeFolder(admin, "listing-photos", uid);
    await removeFolder(admin, "avatars", uid);
  } catch (e) {
    console.error("account delete storage cleanup failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't remove your photos. Please try again." }, { status: 500 });
  }

  // Cascades: profile, listings, listing_photos, offers, alerts, prefs, reviews about them.
  // Set null: threads/messages/trades/reviews they wrote (shown as "Deleted member").
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error("auth deleteUser failed", delErr.message);
    return NextResponse.json({ error: "Couldn't delete your account. Please try again." }, { status: 500 });
  }

  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
