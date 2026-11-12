-- AgsSwap 008 · Storage buckets + object policies.
-- Folds in RenoSwap 001 (buckets), 004 (avatar limits + WITH CHECK),
-- 008 (listing-photos PRIVATE via signed URLs; no anonymous folder listing).
-- storage.* tables are owned by Supabase and keep their own grants; only
-- policies are managed here.

-- avatars: PUBLIC bucket (profile pictures are public by design; public URLs
-- bypass RLS). 1 MB, images only. No blanket SELECT policy, so nobody can
-- list other users' folders.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- listing-photos: PRIVATE bucket. The app renders photos through short-lived
-- signed URLs (src/lib/listing-photos.ts). 20 MB, image/* only (new for
-- AgsSwap; RenoSwap had no bucket-level limit; the app already rejects
-- non-images and re-encodes most photos to JPEG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 20971520, array['image/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------
drop policy if exists "Avatar images are publicly accessible" on storage.objects;

drop policy if exists "Owners read own avatar folder" on storage.objects;
create policy "Owners read own avatar folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- listing-photos
-- ---------------------------------------------------------------------------
drop policy if exists "Listing photos are publicly accessible" on storage.objects;

-- Sign/download a photo only if the caller can see its listing_photos row
-- (RLS there = Approved/Claimed for everyone, plus owner and admins).
drop policy if exists "Read photos of visible listings" on storage.objects;
create policy "Read photos of visible listings"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'listing-photos'
    and storage.allow_any_operation(array[
      'object.sign',
      'object.sign_many',
      'object.get_authenticated',
      'object.get_authenticated_info',
      'object.head_authenticated_info',
      'object.info_authenticated'
    ])
    and exists (
      select 1 from public.listing_photos lp
      where lp.storage_path = storage.objects.name
    )
  );

-- Owners can list their own folder (needed for upsert uploads).
drop policy if exists "Owners read own listing photo folder" on storage.objects;
create policy "Owners read own listing photo folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users upload listing photos" on storage.objects;
create policy "Users upload listing photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update listing photos" on storage.objects;
create policy "Users update listing photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'listing-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete listing photos" on storage.objects;
create policy "Users delete listing photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((select auth.uid())::text = (storage.foldername(name))[1] or public.current_is_admin())
  );
