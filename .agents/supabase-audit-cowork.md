# Supabase Audit & Cleanup — Claude Cowork Brief

Paste this whole file into a Claude Code / cowork session that has access to the
Supabase project (via the **Supabase MCP server**, the **`supabase` CLI logged in**,
or a **Postgres connection string / service-role key**). If none of those are
connected, stop and tell me which one to set up first.

---

## Your role

You are auditing the AmplifyHub Supabase project. Work in **three phases, in order**.
Do **not** skip ahead, and do **not** run any `DROP`, `DELETE`, `TRUNCATE`, `ALTER ... DROP`,
or destructive migration until Phase 3 is explicitly approved by me.

### Hard safety rules (do not violate)
1. **Read-only until told otherwise.** Phases 1 and 2 must not modify data or schema.
   The only writes allowed without asking are **adding comments/descriptions** to objects
   (`COMMENT ON ...`) and **renaming saved SQL snippets' titles** — nothing else.
2. **Never delete anything on your own.** Flag it, explain why, wait for my per-item "yes."
   Some orphans are kept on purpose — assume nothing is safe to drop until I confirm.
3. **No secrets in output.** Never print the service key, connection string, JWT secret,
   or any row containing user PII. Redact.
4. Before any destructive statement in Phase 3, output the **exact SQL** and a **rollback plan**
   first, then wait.

---

## Phase 1 — Discover & inventory (read-only)

Produce a complete inventory. For Postgres, query the catalog; example starting points:

```sql
-- Tables + row counts + size
select
  n.nspname            as schema,
  c.relname            as name,
  c.reltuples::bigint  as approx_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  obj_description(c.oid) as description
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not in ('pg_catalog','information_schema','pg_toast')
order by pg_total_relation_size(c.oid) desc;

-- Views, materialized views, functions/RPCs
select n.nspname, p.proname, obj_description(p.oid) as description
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog','information_schema');

-- RLS policies
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies order by schemaname, tablename;

-- Indexes (to spot unused / duplicate later)
select schemaname, relname as table, indexrelname as index, idx_scan
from pg_stat_user_indexes order by idx_scan asc;

-- Foreign keys / relationships
select conrelid::regclass as table, conname, pg_get_constraintdef(oid)
from pg_constraint where contype = 'f';
```

Also inventory the **Supabase-specific** surfaces:
- **Saved SQL snippets** in the SQL Editor (these are the "queries" I mean — see Phase 2).
- **Database functions / RPCs**, **triggers**, **enums/custom types**.
- **Storage buckets** and their policies.
- **Edge Functions** (list names + last-deployed).
- **Auth**: providers enabled, email templates, redirect URLs (describe, don't change).
- **Extensions** installed.

Deliver Phase 1 as a single Markdown report with one table per category:
`name | schema | purpose (your best inference) | rows/size | last used (if known) | notes`.

---

## Phase 2 — Name & describe every query and object (safe writes OK)

For **every saved SQL snippet and every database object** (table, view, function, RPC,
trigger, enum, bucket, edge function):

1. Give it a **clear, consistent name** (kebab or snake per existing convention — match
   what's already there; don't rename schema objects, only retitle *saved SQL snippets*
   whose titles are vague like "Untitled query 3").
2. Write a **one-to-two sentence description**: what it does, what reads/writes it,
   and when it's used.

Persist the descriptions on the DB objects themselves so they survive:

```sql
COMMENT ON TABLE  public.<table>    IS '<description>';
COMMENT ON COLUMN public.<table>.<col> IS '<description>';   -- for non-obvious columns
COMMENT ON FUNCTION public.<fn>(<args>) IS '<description>';
COMMENT ON VIEW   public.<view>     IS '<description>';
```

For saved SQL snippets (which can't hold a SQL comment), prepend a header comment block
inside the snippet body:

```sql
-- Name: active-users-last-30d
-- Description: Users with a session in the last 30 days, for the dashboard KPI card.
-- Owner/used by: dashboard.tsx > KPIStrip
```

Output a **Query Catalog** table: `name | one-line description | type | referenced by`.

---

## Phase 3 — Propose removals (NOTHING deleted without my per-item approval)

Do **not** delete. Produce a **"Candidates for removal"** table, ranked, with evidence:

`object | type | why it looks unused | confidence | risk if removed | proposed action`

Signals to use as evidence (all must be shown, not assumed):
- Zero `idx_scan` for indexes; `seq_scan`/`n_live_tup = 0` for tables.
- Functions/RPCs with **no references** in the app repo (grep the codebase for the name).
- Saved snippets that are duplicates or one-off scratch queries.
- Orphan tables with **no foreign keys and no code references**.
- Duplicate indexes covering the same columns.

For each candidate, also state what would break, and provide the **exact reversible SQL**
plus a **backup step** (e.g. `pg_dump` of the object, or `create table _archive_x as select * from x`)
to run *before* any drop.

Then **stop and wait.** I approve or reject each item individually. Only after I say
"yes, drop <X>" do you run that single statement.

---

## Deliverables recap
1. `phase1-inventory.md` — full inventory.
2. `phase2-query-catalog.md` — every query/object named + described (+ `COMMENT ON` applied).
3. `phase3-removal-candidates.md` — ranked proposals with evidence, rollback, awaiting my approval.

Start with Phase 1 now. Do not proceed to Phase 3 destructive actions without explicit per-item approval.
