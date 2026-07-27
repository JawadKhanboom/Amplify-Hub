-- Public buckets serve object URLs without a SELECT policy; the broad SELECT
-- policy only enabled listing/enumeration of all avatar files. Drop it so
-- <img> display still works (public URL) but the bucket can't be listed.
--
-- NOTE: applied directly to the linked project on 2026-07-25 and back-filled
-- into the repo afterwards so local and remote migration history match.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
