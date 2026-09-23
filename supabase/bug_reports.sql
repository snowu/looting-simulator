-- Looting Simulator — in-game bug reports.
--
-- Paste into the Supabase SQL editor of the project that hosts the games. It is
-- safe to re-run: every statement is idempotent.
--
-- The `report-bug` Edge Function (supabase/functions/report-bug) is the only
-- writer. It uses the service role, so the table has row-level security on and
-- no policies: no player can read or write it directly.

-- One row per report sent: the rate limit counts these, and the issue number
-- ties a player's report back to GitHub without storing who they are there.
create table if not exists public.bug_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_number integer,
  screenshot_path text,
  created_at timestamptz not null default now()
);

create index if not exists bug_reports_user_recent on public.bug_reports (user_id, created_at desc);

alter table public.bug_reports enable row level security;

-- Screenshots are embedded in public GitHub issues, so the bucket is public
-- for reading. Only the function (service role) uploads. PNG only, 3 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-screenshots', 'bug-screenshots', true, 3145728, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
