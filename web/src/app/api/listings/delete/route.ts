import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { LISTING_PHOTO_BUCKET } from "@/lib/listing-photos";
import { getMyProfile } from "@/lib/supabase/my-profile";

export const dynamic = "force-dynamic";

/**
 * Soft-delete a listing the signed-in user owns (or an admin).
 * Marks status Deleted (off Browse), withdraws pending offers, removes photos.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { listingId?: string };
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  if (!listingId) {
    return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  // RLS: owner can read own listing; admins can read all.
  const { data: listing, error: readErr } = await supabase
    .from("listings")
    .select("id, poster_id, status")
    .eq("id", listingId)
    .maybeSingle();
  if (readErr) {
    console.error("listing delete read failed", readErr.message);
    return NextResponse.json({ error: "Couldn't delete this listing." }, { status: 500 });
  }
  if (!listing) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const { data: profile } = await getMyProfile(supabase);
  const isAdmin = !!profile?.is_admin;
  if (listing.poster_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: "You can only delete your own listings." }, { status: 403 });
  }
  if (listing.status === "Deleted") {
    return NextResponse.json({ ok: true, already: true });
  }

  // Soft-delete via RPC (owner/admin check + status + withdraw pending offers).
  const { error: rpcErr } = await supabase.rpc("delete_own_listing", {
    p_listing_id: listingId,
  });
  if (rpcErr) {
    console.error("delete_own_listing failed", rpcErr.message);
    return NextResponse.json(
      { error: rpcErr.message.includes("Only the owner")
          ? "You can only delete your own listings."
          : "Couldn't delete this listing. Please try again." },
      { status: 500 }
    );
  }

  // Best-effort: remove photo files and rows so the post is gone from storage too.
  try {
    const admin = createServiceClient();
    const { data: photos } = await admin
      .from("listing_photos")
      .select("id, storage_path")
      .eq("listing_id", listingId);
    const paths = (photos || []).map((p) => p.storage_path).filter(Boolean) as string[];
    if (paths.length) {
      await admin.storage.from(LISTING_PHOTO_BUCKET).remove(paths);
    }
    await admin.from("listing_photos").delete().eq("listing_id", listingId);
  } catch (e) {
    console.error(
      "listing delete photo cleanup failed",
      e instanceof Error ? e.message : e
    );
    // Listing is already off Browse; don't fail the whole delete.
  }

  return NextResponse.json({ ok: true });
}
