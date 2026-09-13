# Supabase Login And Cross-Device Saves

Implementation brief for adding optional passwordless accounts and cross-device
save synchronization. The game must remain fully playable without an account or
network connection.

## Goals

- Sign in without a password using an email code.
- Continue the same complete game state on another device.
- Keep local saving immediate and reliable while offline.
- Never silently overwrite meaningful progress from another device.
- Preserve existing anonymous saves and all additive save migrations.

## Decisions

### Use email OTP, not a magic link

Use `signInWithOtp()` followed by `verifyOtp()` with a six-digit code entry.
PKCE magic links can rely on a verifier stored in the browser that initiated the
request, so opening the email on another device may fail. A typed code works on
the device where the player wants to continue.

Authentication is optional. Anonymous players continue using `localStorage`
exactly as they do now.

### Keep local saves authoritative during play

`saveGame()` remains synchronous and writes to `localStorage`. Cloud sync sits
around it as an asynchronous coordinator:

1. Save locally immediately.
2. Mark the current snapshot dirty.
3. Debounce an upload while online and signed in.
4. Flush at reliable checkpoints such as entering town, changing floors and
   ending a run.
5. Retry after reconnecting.

Do not depend on `beforeunload`, `pagehide` or background events completing a
network request. Those hooks should continue to guarantee only the local save.

### Synchronize one atomic snapshot

Store the complete `GameState` JSON. Do not independently merge inventory,
equipment, floors, economy, contracts or RNG state. Their invariants cross
system boundaries, and field-level merging could duplicate items, resurrect a
dead run or rewind only part of the economy.

### Use optimistic concurrency

Every cloud save has a server-controlled monotonic `generation`. An upload says
which generation it is replacing. If that generation is no longer current, the
server rejects the write as a conflict instead of silently accepting whichever
device wrote last.

Conflicts are resolved only at the title screen or in town. Never replace state
while a `World` is active: `World` retains direct references to the existing
`GameState` and `RunState`.

## Database

The source of truth is `supabase/game_saves.sql` — paste that file into the
Supabase SQL editor. Do not copy SQL from this document; any snippet here will
rot. Shape of the schema:

- One row per playthrough: primary key `(user_id, slot)` with `slot` in 1..3,
  plus a per-user unique `save_id` so a playthrough is recognised wherever a
  device files it.
- Row-level security is the security boundary: every policy is scoped to
  `auth.uid() = user_id`. The `save_game` / `delete_game` functions run as
  `security invoker` and derive the user from `auth.uid()` — the client never
  sends a `user_id`.
- Table constraints cap the blast radius of a tampered client: `state` ≤ 2MB,
  `save_id` ≤ 64 chars, `device_id` ≤ 128 chars, `content_hash` exactly 16
  lowercase hex chars. The RPC functions validate the same limits up front.

Normal browser traffic uses the public publishable/anon key and the signed-in
user's JWT. Never put a service-role key in this repository, GitHub Pages, Vite
variables or browser code. RLS is the security boundary.

### Compare-and-swap function

Uploads go through `save_game(slot, save_id, expected_generation, state,
format_version, schema_revision, device_id, content_hash)` (see
`supabase/game_saves.sql` for the exact contract):

- Insert generation 1 when neither the playthrough nor the slot exists and the
  expected generation is null.
- Return `stale_client` when the caller is older than the row's format.
- Return `unchanged` when the content hash already matches.
- Update only where `user_id = auth.uid()` and `generation` equals
  `expected_generation`, otherwise return `conflict`.
- Increment `generation` and set `updated_at = now()` in the database.

The server generation, not a device clock, decides ordering. CAS ordering is a
data-integrity guarantee for honest clients, not the security boundary: direct
table writes are constrained by the same RLS policies and CHECK constraints,
so they can only ever touch the caller's own rows.

## Client Structure

Install `@supabase/supabase-js` as a normal dependency and add modules along
these lines:

```text
src/cloud/supabase.ts       client initialization and auth session
src/cloud/cloud-save.ts     fetch, CAS upload and validation
src/cloud/sync.ts           local-first coordinator and conflict state
src/ui/account.ts           OTP dialog, account menu and save chooser
```

Use build-time public variables:

```text
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Add placeholders to `.env.example`, production values to GitHub Actions
environment secrets/variables, and do not commit a local `.env`.

The relevant pattern in another local project is:

```text
/home/snow/personal/emt_madrid_widget/web/app.js
```

That project recovers the initial session with `auth.getSession()`, listens to
`onAuthStateChange()`, and defers work from the callback with `setTimeout()` so
it does not wait while Supabase's internal auth lock is held. Reuse that session
handling pattern, but use a code-entry OTP interface here rather than relying on
a magic-link callback.

## Sign-In And Reconciliation

The title screen is the safest first sign-in location. Town can show a compact
account and sync-status control after initialization.

On first sign-in, compare the local and cloud envelopes. If only one exists,
offer the obvious upload or download. If both exist and differ, show both:

```text
This device                 Cloud save
Day 8                       Day 11
Depth 3, active delve       In town
1,240 gold                  1,680 gold
Saved locally now           Saved 2 hours ago
```

Actions:

- **Continue this device**: CAS-upload the local snapshot.
- **Continue cloud save**: validate, migrate and install the cloud snapshot,
  then reload the owning world/UI objects.
- **Keep playing offline**: make no cloud change.
- **Sign out**: leave the local save intact by default.

Never decide by day, gold or depth automatically; each can legitimately go
backward during play. A conflict always requires an explicit choice.

## Save Validation And Compatibility

Cloud downloads must pass the same format checks and `parseSave()` migrations
as local saves before becoming active.

- Reject a different `SAVE_VERSION` without touching the local save.
- Migrate an older additive `revision` before use.
- Refuse to upload from a client whose supported revision is older than the
  cloud snapshot's revision; show **Update required**.
- Do not let `saveGame()` relabel a future revision as the current one. The
  current implementation assigns `SAVE_REVISION` unconditionally and should be
  guarded before cloud sync ships.
- Keep the cloud envelope fields outside `GameState`; they describe sync, not
  game mechanics.

## Upload Policy

Cloud writes should be debounced and content-hashed because some town UI-only
changes currently call the same commit path as real state changes.

Suggested policy:

- Local save: every existing save point, unchanged.
- Debounced cloud save: 2-5 seconds after a changed local snapshot.
- Immediate cloud attempt: floor transition, return to town, run completion,
  explicit **Sync now**, and successful first-device upload.
- Active dungeon fallback: the existing 15-second local checkpoint may mark
  cloud state dirty, but should not create an upload every frame or every local
  call.
- Skip uploads when the serialized content hash has not changed.

If offline or Supabase is unavailable, display a quiet **Saved on this device**
state and retry later. Cloud failure must never make local saving fail.

## Reset, Sign-Out And Multiple Devices

- Reset while signed in must write the new game through CAS, or write a
  tombstone, so an older cloud snapshot cannot return on reload.
- Sign-out keeps the local save unless the player explicitly chooses **Remove
  this account's save from this device**.
- Store a random persistent `device_id` separately from `GameState`.
- Account switching must reconcile against the newly signed-in user's row; do
  not automatically upload the previous account's local state.
- A stale device that reconnects receives a conflict and cannot overwrite the
  newer generation silently.

## GitHub Pages And Supabase Configuration

The deployed application root is:

```text
https://snowu.github.io/looting-simulator/
```

GitHub Pages has no SPA route fallback, so do not create an
`/auth/callback` route. OTP code entry avoids that requirement. Configure the
Supabase Site URL and allowed redirect URLs with the exact production root and
the local Vite URL used during development.

The Supabase URL and publishable key are intentionally public. Add them to the
GitHub Pages build environment; authorization comes from JWT validation and
RLS, not from hiding the key.

## UI States

Keep account status small and non-blocking:

- `Offline save`
- `Sending code...`
- `Code sent to name@example.com`
- `Saved on this device`
- `Syncing...`
- `Synced`
- `Cloud save available`
- `Conflict: choose a save`
- `Update required to use this cloud save`

Do not interrupt combat with dialogs or remote-state application. A newer cloud
generation discovered during a run waits until town/title for resolution.

## Implementation Order

1. Create the Supabase project, enable email OTP and apply the table/RLS/CAS SQL.
2. Add environment configuration and initialize the Supabase client.
3. Add OTP request, verification, session recovery and sign-out UI.
4. Extract serialization/validation so local and cloud saves use one path.
5. Guard future revisions from being downgraded or uploaded.
6. Implement cloud fetch and compare-and-swap upload.
7. Add the local-first debounced sync coordinator.
8. Add first-login reconciliation and conflict UI at title/town.
9. Define reset and account-switch behavior in the UI.
10. Test offline, stale-device, active-run and incompatible-save cases before
    enabling production sync.

## Tests Required

- Existing anonymous/local saves behave exactly as before.
- OTP request, verification, session recovery and sign-out states.
- Local save succeeds while Supabase is offline or errors.
- Repeated unchanged saves produce no cloud write.
- Debouncing coalesces rapid state changes.
- CAS update succeeds with the current generation.
- A stale generation produces a conflict and preserves both candidates.
- First sign-in can explicitly choose local or cloud state.
- A remote update is not hot-applied during an active dungeon.
- Old cloud revisions migrate before use.
- Future and incompatible revisions preserve the local save and never upload.
- Reset cannot be undone by an older cloud snapshot.
- Switching accounts cannot leak one user's save into another account.
- RLS tests prove users cannot read or write another user's row.

## Deferred Decisions

- Whether signing out should offer a one-click local-save removal every time.
- Whether to retain a small server-side snapshot history for manual recovery.
- Whether account/sync controls belong in the town header or the Chronicle.
- Exact debounce interval and whether dungeon checkpoints upload every 15 or 30
  seconds after observing real payload sizes.
