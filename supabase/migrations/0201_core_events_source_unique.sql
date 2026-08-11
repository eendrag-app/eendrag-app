-- Fix: make the events mirror actually upsertable.
--
-- 0200 created the source index as a PARTIAL unique index:
--
--   create unique index events_source on events (source_module, source_ref)
--     where source_module is not null;
--
-- Postgres will not infer a partial index for `insert ... on conflict
-- (source_module, source_ref)` unless the statement repeats the index's WHERE
-- clause, which PostgREST has no way to send. So every call to
-- upsertModuleEvent() failed with 42P10 ("no unique or exclusion constraint
-- matching the ON CONFLICT specification") — found the first time a sport rep
-- posted a fixture in phase two.
--
-- A plain unique index does the same job here: UNIQUE treats NULLs as
-- distinct, so admin-created events (both columns null) are unaffected and can
-- exist in any number, while module mirrors stay one row per
-- (source_module, source_ref). The existing check constraint already forbids
-- setting only one of the two.

drop index events_source;

create unique index events_source on events (source_module, source_ref);
