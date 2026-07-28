-- Make the Resource Library catalog and downloadable artifacts member-only.
-- Existing generated files are uploaded separately after this migration.

revoke all privileges on public.resource_catalog
  from anon;
revoke all privileges on public.resource_catalog
  from authenticated;
grant select on public.resource_catalog
  to authenticated;

drop policy if exists "Public reads reviewed active resources"
  on public.resource_catalog;
drop policy if exists "Authenticated members read reviewed active resources"
  on public.resource_catalog;
create policy "Authenticated members read reviewed active resources"
  on public.resource_catalog
  for select
  to authenticated
  using (active = true and status = 'reviewed');

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'resource-downloads',
    'resource-downloads',
    false,
    5242880,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  )
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated members download resources"
  on storage.objects;
create policy "Authenticated members download resources"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'resource-downloads');

-- Replace legacy public asset paths with canonical private object paths.
update public.resource_catalog as catalog
set downloads = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'format', lower(item ->> 'format'),
        'path', catalog.id || '.' || lower(item ->> 'format')
      )
      order by item_index
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(catalog.downloads) with ordinality
    as items(item, item_index)
  where lower(item ->> 'format') in ('pdf', 'docx', 'xlsx')
)
where jsonb_typeof(downloads) = 'array';
