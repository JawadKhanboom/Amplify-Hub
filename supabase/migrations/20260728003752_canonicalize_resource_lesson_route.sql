-- Keep the live resource catalog aligned with the canonical React lesson route.
-- The original seed and catalog-sync migrations may already be applied, so this
-- correction is intentionally forward-only.

update public.resource_catalog
set related_route = 'sales-mindset/index.html#lesson-2'
where id = 'worksheets-rejection-log'
  and related_route is distinct from 'sales-mindset/index.html#lesson-2';
