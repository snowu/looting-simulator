-- Looting Simulator — cloud saves.
--
-- Paste into the Supabase SQL editor of the project that hosts the games. It is
-- safe to re-run: every statement is idempotent, and re-running never touches a
-- stored save.
--
-- This adds one table and one function. It does not read, alter or depend on
-- anything else already in the project; only `auth.users` is shared.

create table if not exists public.game_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- One row per playthrough. Slots are independent saves, not a history.
  slot smallint not null default 1,
  -- Identifies the playthrough itself. Slots are positions: the same game can
  -- be slot 1 on a laptop and slot 3 on a phone, and sync matches on this.
  -- Nullable because rows written before ids existed have none until their
  -- device next uploads.
  save_id text,
  state jsonb not null,
  format_version integer not null,
  schema_revision integer not null,
  generation bigint not null default 1,
  device_id text not null,
  content_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- Installs from before slots existed: give the existing row slot 1 and move the
-- key onto (user_id, slot). The save itself is never touched.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'game_saves' and column_name = 'slot'
  ) then
    alter table public.game_saves add column slot smallint not null default 1;
    alter table public.game_saves drop constraint game_saves_pkey;
    alter table public.game_saves add primary key (user_id, slot);
  end if;
end $$;

alter table public.game_saves add column if not exists save_id text;

-- One playthrough cannot occupy two slots. Partial, because legacy rows share
-- a null id until the device that owns them uploads again.
create unique index if not exists game_saves_user_save_id
  on public.game_saves (user_id, save_id) where save_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'game_saves_slot_range' and conrelid = 'public.game_saves'::regclass
  ) then
    alter table public.game_saves
      add constraint game_saves_slot_range check (slot between 1 and 3);
  end if;
end $$;

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
-- the schema does not depend on the project's default privileges. Delete is
-- granted because the title screen lets the player remove a save outright, but
-- only through the `delete_game` function below and behind a double confirm.
grant select, insert, update, delete on public.game_saves to authenticated;

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

-- Resetting the game writes a fresh state through the same compare-and-swap,
-- so an older snapshot cannot come back on the next reload. Removing a save
-- outright goes through `delete_game` below instead, so the row is found by
-- the playthrough's identity wherever it sits rather than by slot position.
drop policy if exists "players can delete their own save" on public.game_saves;
create policy "players can delete their own save"
on public.game_saves for delete
using (auth.uid() = user_id);

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
-- The slots-without-ids signature never shipped, so nothing is calling it.
drop function if exists public.save_game(smallint, bigint, jsonb, integer, integer, text, text);

create or replace function public.save_game(
  p_slot smallint,
  p_save_id text,
  p_expected_generation bigint,
  p_state jsonb,
  p_format_version integer,
  p_schema_revision integer,
  p_device_id text,
  p_content_hash text
)
returns table (result_status text, result_slot smallint, result_generation bigint, result_updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.game_saves%rowtype;
  v_gen bigint;
  v_at timestamptz;
  v_slot smallint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Identity first, position second. The same playthrough can sit in a
  -- different slot on every device, so a save is found by what it is and only
  -- then by where this device happens to file it.
  if p_save_id is not null then
    select * into v_current from public.game_saves
    where user_id = v_uid and save_id = p_save_id;
  end if;

  if v_current.user_id is null then
    select * into v_current from public.game_saves
    where user_id = v_uid and slot = p_slot;
  end if;

  -- Neither this playthrough nor anything in the requested slot: a new row.
  if v_current.user_id is null then
    if p_expected_generation is not null then
      return query select 'conflict'::text, p_slot, null::bigint, null::timestamptz;
      return;
    end if;
    insert into public.game_saves (user_id, slot, save_id, state, format_version, schema_revision, generation, device_id, content_hash)
    values (v_uid, p_slot, p_save_id, p_state, p_format_version, p_schema_revision, 1, p_device_id, p_content_hash)
    returning game_saves.slot, game_saves.generation, game_saves.updated_at into v_slot, v_gen, v_at;
    return query select 'ok'::text, v_slot, v_gen, v_at;
    return;
  end if;

  -- An older build must not write over a save in a format it cannot fully
  -- read. The client checks this too; here it is enforced.
  if p_format_version < v_current.format_version or p_schema_revision < v_current.schema_revision then
    return query select 'stale_client'::text, v_current.slot, v_current.generation, v_current.updated_at;
    return;
  end if;

  -- Town UI churn reaches the same commit path as real progress, so an upload
  -- that would change nothing is dropped before it costs a generation.
  if v_current.content_hash = p_content_hash then
    return query select 'unchanged'::text, v_current.slot, v_current.generation, v_current.updated_at;
    return;
  end if;

  if p_expected_generation is null or p_expected_generation <> v_current.generation then
    return query select 'conflict'::text, v_current.slot, v_current.generation, v_current.updated_at;
    return;
  end if;

  -- The row keeps the slot it already occupies: a playthrough already filed on
  -- this account does not move because another device numbers its slots
  -- differently.
  update public.game_saves
  set state = p_state,
      save_id = coalesce(p_save_id, save_id),
      format_version = p_format_version,
      schema_revision = p_schema_revision,
      generation = v_current.generation + 1,
      device_id = p_device_id,
      content_hash = p_content_hash,
      updated_at = now()
  where user_id = v_uid and slot = v_current.slot and generation = p_expected_generation
  returning game_saves.slot, game_saves.generation, game_saves.updated_at into v_slot, v_gen, v_at;

  -- Lost a race between the read above and the update.
  if v_gen is null then
    select slot, generation, updated_at into v_slot, v_gen, v_at
    from public.game_saves where user_id = v_uid and slot = v_current.slot;
    return query select 'conflict'::text, v_slot, v_gen, v_at;
    return;
  end if;

  return query select 'ok'::text, v_slot, v_gen, v_at;
end;
$$;

revoke all on function public.save_game(smallint, text, bigint, jsonb, integer, integer, text, text) from public, anon;
grant execute on function public.save_game(smallint, text, bigint, jsonb, integer, integer, text, text) to authenticated;

/*
 * The pre-slots signature, kept as a shim onto slot 1.
 *
 * This is a phone game installed as a PWA: a client that has not picked up the
 * new build yet is still out there calling the old six-argument form, and
 * dropping it would turn every one of their uploads into an error until they
 * happened to update. Slot 1 is where a save from before slots existed already
 * lives, so delegating there is both compatible and correct. It can be dropped
 * once no old clients remain.
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
language sql
security invoker
set search_path = public, pg_temp
as $$
  select result_status, result_generation, result_updated_at
  from public.save_game(1::smallint, null::text, p_expected_generation, p_state,
                        p_format_version, p_schema_revision, p_device_id, p_content_hash);
$$;

revoke all on function public.save_game(bigint, jsonb, integer, integer, text, text) from public, anon;
grant execute on function public.save_game(bigint, jsonb, integer, integer, text, text) to authenticated;

/*
 * Delete a playthrough outright.
 *
 * Identity first, position second, mirroring `save_game`: a save with an id
 * is removed wherever it sits, because the same playthrough can be filed
 * under a different slot on each device. A null id means a row from before
 * ids existed, which can only be addressed by position. This is an explicit,
 * confirmed player action from the title screen, so it wins over whatever
 * generation is up there — no generation check, no tombstone.
 */
create or replace function public.delete_game(
  p_slot smallint,
  p_save_id text default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_save_id is not null then
    delete from public.game_saves where user_id = v_uid and save_id = p_save_id;
  else
    delete from public.game_saves where user_id = v_uid and slot = p_slot;
  end if;
end;
$$;

revoke all on function public.delete_game(smallint, text) from public, anon;
grant execute on function public.delete_game(smallint, text) to authenticated;
