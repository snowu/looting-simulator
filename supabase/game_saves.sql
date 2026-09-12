-- Looting Simulator — cloud saves.
--
-- Paste into the Supabase SQL editor of the project that hosts the games. It is
-- safe to re-run: every statement is idempotent, and re-running never touches a
-- stored save.
--
-- This adds one table and one function. It does not read, alter or depend on
-- anything else already in the project; only `auth.users` is shared.

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  format_version integer not null,
  schema_revision integer not null,
  generation bigint not null default 1,
  device_id text not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);

-- A real save is tens of kilobytes; a deep run with many floors is a few hundred.
-- The cap is far above any honest save and exists so a tampered or buggy client
-- cannot quietly eat the project's storage quota.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_saves_state_size' and conrelid = 'public.game_saves'::regclass
  ) then
    alter table public.game_saves
      add constraint game_saves_state_size check (pg_column_size(state) <= 2 * 1024 * 1024);
  end if;
end $$;

alter table public.game_saves enable row level security;

-- Supabase grants these on new public tables by default; stated explicitly so
-- the schema does not depend on the project's default privileges. There is no
-- delete grant: a save is replaced, never removed.
grant select, insert, update on public.game_saves to authenticated;

-- RLS is the security boundary: the browser holds only the publishable key and
-- the player's own JWT, so every policy is scoped to their own row.
drop policy if exists "players can read their own save" on public.game_saves;
create policy "players can read their own save"
on public.game_saves for select
using (auth.uid() = user_id);

drop policy if exists "players can create their own save" on public.game_saves;
create policy "players can create their own save"
on public.game_saves for insert
with check (auth.uid() = user_id);

drop policy if exists "players can update their own save" on public.game_saves;
create policy "players can update their own save"
on public.game_saves for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Deliberately no delete policy: a save is replaced, never removed. Resetting
-- the game writes a fresh state through the same compare-and-swap, so an older
-- snapshot cannot come back on the next reload.

/*
 * Compare-and-swap upload.
 *
 * The server's `generation`, never a device clock, decides ordering: an upload
 * states which generation it believes it is replacing, and a device that has
 * fallen behind is told so rather than being allowed to flatten the newer save.
 *
 * Returns exactly one row:
 *   ok           the write landed; result_generation is the new generation
 *   unchanged    the row already holds this exact snapshot; nothing was written
 *   conflict     another device has written since; the caller must ask the player
 *   stale_client this build is older than the format in the row; it must update
 *
 * Output columns are prefixed so the body can reference table columns without
 * plpgsql resolving them to the OUT parameters.
 */
create or replace function public.save_game(
  p_expected_generation bigint,
  p_state jsonb,
  p_format_version integer,
  p_schema_revision integer,
  p_device_id text,
  p_content_hash text
)
returns table (result_status text, result_generation bigint, result_updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.game_saves%rowtype;
  v_gen bigint;
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_current from public.game_saves where user_id = v_uid;

  -- No row yet. Only an upload that expects to find none may create one; an
  -- upload naming a generation has lost a row it thought existed.
  if not found then
    if p_expected_generation is not null then
      return query select 'conflict'::text, null::bigint, null::timestamptz;
      return;
    end if;
    insert into public.game_saves (user_id, state, format_version, schema_revision, generation, device_id, content_hash)
    values (v_uid, p_state, p_format_version, p_schema_revision, 1, p_device_id, p_content_hash)
    returning game_saves.generation, game_saves.updated_at into v_gen, v_at;
    return query select 'ok'::text, v_gen, v_at;
    return;
  end if;

  -- An older build must not write over a save in a format it cannot fully
  -- read. The client checks this too; here it is enforced.
  if p_format_version < v_current.format_version or p_schema_revision < v_current.schema_revision then
    return query select 'stale_client'::text, v_current.generation, v_current.updated_at;
    return;
  end if;

  -- Town UI churn reaches the same commit path as real progress, so an upload
  -- that would change nothing is dropped before it costs a generation.
  if v_current.content_hash = p_content_hash then
    return query select 'unchanged'::text, v_current.generation, v_current.updated_at;
    return;
  end if;

  if p_expected_generation is null or p_expected_generation <> v_current.generation then
    return query select 'conflict'::text, v_current.generation, v_current.updated_at;
    return;
  end if;

  update public.game_saves
  set state = p_state,
      format_version = p_format_version,
      schema_revision = p_schema_revision,
      generation = v_current.generation + 1,
      device_id = p_device_id,
      content_hash = p_content_hash,
      updated_at = now()
  where user_id = v_uid and generation = p_expected_generation
  returning game_saves.generation, game_saves.updated_at into v_gen, v_at;

  -- Lost a race between the read above and the update.
  if v_gen is null then
    select generation, updated_at into v_gen, v_at from public.game_saves where user_id = v_uid;
    return query select 'conflict'::text, v_gen, v_at;
    return;
  end if;

  return query select 'ok'::text, v_gen, v_at;
end;
$$;

revoke all on function public.save_game(bigint, jsonb, integer, integer, text, text) from public, anon;
grant execute on function public.save_game(bigint, jsonb, integer, integer, text, text) to authenticated;
