# Blueprint Run Persistence Cleanup Spec

**Date:** 2026-04-05

**Scope:** Tighten Blueprint mode persistence so only saved workflows create durable run records, and automatically clean up existing historical run data that should never have been stored.

## Goal

Blueprint currently persists run history too early. A user can execute a workflow before saving it to a seed, and the backend still creates `blueprint_workflow_runs` and `blueprint_workflow_run_steps` records. That leaves behind orphaned execution history that the product does not want to preserve.

The new rule is simple:

- unsaved Blueprint workflows may execute, stream logs, and render results in the current session
- unsaved Blueprint workflows must not create durable run records or step records
- saved Blueprint workflows may continue to use persistent history, detail, cancellation, and continuation flows
- existing historical run data that violates this rule must be deleted

Success means the database only contains Blueprint runs that are traceable to a saved seed context owned or imported by the current user.

This spec intentionally prefers strict deletion over partial retention. If a historical run cannot be proven to belong to a saved Blueprint context, it should be treated as invalid and removed.

## Non-Goals

- Do not redesign the Blueprint canvas, runtime cards, or seed sidebar UI.
- Do not remove in-session execution logs for unsaved runs.
- Do not change how saved seeds and copies are created or updated.
- Do not backfill missing seeds for historical runs; invalid rows should be deleted, not repaired.

## Product Rules

### Run Persistence Requires Saved Workflow Context

A Blueprint execution may persist only when all of the following are true:

- request `seed` is present and passes the existing Blueprint seed validation
- the seed exists in `blueprint_workflow_sources`
- the current user has a durable relationship to that seed:
  - they are the source owner, or
  - they already have a row in `blueprint_workflow_copies`, or
  - the workflow was previously imported and therefore created a user copy

If any of those checks fail, execution must remain session-only and must not write durable run data.

More concretely:

- `seed = ''`, `NULL`, malformed, or not found in source storage means non-persistent execution
- a source row without matching ownership or user copy means non-persistent execution
- the current request `workflow` payload does not by itself make a run persistable; only saved seed context does
- persistence is a policy decision at execution start and must not change midway through a run

### Unsaved Runs Must Behave As Ephemeral Sessions

Unsaved execution is still allowed, but it becomes an ephemeral session:

- no `blueprint_workflow_runs` insert
- no `blueprint_workflow_run_steps` upsert
- no persistent `runId` expected by history APIs
- frontend still shows stream events, node progress, runtime output, and generated playable output for the current page session
- leaving the page simply aborts the local request; there is no durable run to cancel on the backend

### Persistent Features Exist Only For Saved Runs

The following features remain available only when a run is persisted:

- `/api/blueprints/runs`
- `/api/blueprints/runs/:runId`
- `/api/blueprints/runs/:runId/cancel`
- continuation from failed historical runs
- auto-cancel on leave using a persistent `runId`

The frontend should degrade gracefully when the current execution is not persistent instead of treating that state as an error.

## Data Integrity Rules

### Saved Workflow Is Defined By Storage, Not Canvas State

The frontend may have a visually complete canvas and even a seed-looking value in memory, but that is not sufficient for durable run storage.

The backend remains authoritative. A workflow counts as saved only when its seed relationship is already represented in Blueprint persistence tables.

### Cleanup And Runtime Gating Must Share The Same Validity Model

The system must not use one rule for deciding whether to persist a new run and a different rule for deleting old runs.

Required invariant:

- if a `{ run.seed, run.owner_user_id }` pair would not pass the current persistence gate, that run is invalid and should be cleanup-eligible
- if a run would pass the current persistence gate, cleanup must preserve it

## Architecture Changes

### Introduce A Single Persistence Gate

Files:
[backend/services/blueprint/blueprintRunService.js](backend/services/blueprint/blueprintRunService.js)
[backend/repositories/blueprintRepository.js](backend/repositories/blueprintRepository.js)

Run persistence should be decided once near the beginning of execution, before any run record is created.

Recommended shape:

- add a repository/service helper that resolves whether a given `{ seed, userId }` pair is persistable
- return a structured result such as `{ shouldPersist, normalizedSeed, sourceExists, hasUserCopy, isSourceOwner }`
- use that helper inside `executeBlueprintWorkflow(...)`

Recommended helper semantics:

- malformed seed: return `shouldPersist = false` without throwing
- missing seed: return `shouldPersist = false`
- source exists and owner matches: return `shouldPersist = true`
- source exists and user copy exists: return `shouldPersist = true`
- source missing: return `shouldPersist = false`
- source exists but user is neither owner nor copy holder: return `shouldPersist = false`

That helper becomes the single policy source for:

- whether to call `createBlueprintRunRecord(...)`
- whether to call `upsertBlueprintRunStepRecord(...)`
- whether cancellation-state reads should hit the store
- whether historical cleanup should preserve or delete a run

### Keep Execution Logic Shared Across Persistent And Ephemeral Runs

File:
[backend/services/blueprint/blueprintRunService.js](backend/services/blueprint/blueprintRunService.js)

The core execution loop should still run for both cases. The difference is whether persistence side effects are enabled.

Suggested behavior:

- derive `persistRun` before execution starts
- only allocate `runId` and register active run control if `persistRun` is true
- guard every persistence write behind `persistRun`
- keep stream payload shape compatible, but allow `runId` to be empty for ephemeral runs

Recommended stream contract addition:

- include a boolean field such as `persistent: true | false` on `workflow-start`
- frontend should treat `persistent: false` as authoritative even if a stale local `seed` exists
- subsequent step events may omit this field once the start event has established the mode

This avoids duplicating execution logic while making persistence policy explicit.

### Make Cancellation Logic Persistence-Aware

Files:
[backend/services/blueprint/blueprintRunService.js](backend/services/blueprint/blueprintRunService.js)
[src/composables/blueprint/useBlueprintExecution.js](src/composables/blueprint/useBlueprintExecution.js)
[src/views/BlueprintMode.vue](src/views/BlueprintMode.vue)

Current leave/cancel behavior assumes every active run has a durable `runId`. That assumption must stop.

New rules:

- if the current execution is ephemeral, frontend cancel only aborts the fetch stream locally
- if the current execution is persistent, existing `/runs/:runId/cancel` behavior remains
- auto-cancel on route leave should only call the backend when the current run is persistent
- run-history hydration should be skipped when no durable `runId` exists
- ephemeral runs must not be added into `sessionRunIds` as if they were durable history records
- `latestRunId` may legitimately remain empty during an active execution, and UI logic must accept that state

The UI should still surface that execution stopped; it just should not attempt persistence APIs that cannot succeed.

### Clean Historical Invalid Runs Automatically

Files:
[backend/repositories/blueprintRepository.js](backend/repositories/blueprintRepository.js)
[backend/services/blueprint/blueprintCommon.js](backend/services/blueprint/blueprintCommon.js)

The backend needs an idempotent cleanup pass for historical invalid data.

Rows should be considered invalid and deleted when either condition is true:

- `blueprint_workflow_runs.seed` is empty or `NULL`
- run seed no longer maps to a valid saved Blueprint context for the owning user:
  - no matching source row for that seed, or
  - no matching user copy and the run owner is not the source owner

Concrete examples of invalid rows:

- a run created before the user ever saved the current canvas to a seed
- a run with a seed string that never existed in `blueprint_workflow_sources`
- a run owned by user B for a seed where only user A owns the source and user B has no copy row

Concrete examples of valid rows:

- the source owner ran their own saved seed
- another user imported the seed, which created a copy row, and later ran that copy-backed workflow

Cleanup order:

1. identify invalid run ids
2. delete matching rows from `blueprint_workflow_run_steps`
3. delete matching rows from `blueprint_workflow_runs`

This cleanup should be safe to execute multiple times and should leave valid persisted runs untouched.

Recommended trigger:

- execute cleanup as part of Blueprint table readiness/bootstrap, after table creation succeeds
- keep the cleanup bounded to Blueprint tables only
- ensure bootstrap cleanup runs once per server process, not once per request after readiness is established

Recommended repository API shape:

- `resolveBlueprintRunPersistenceEligibility(executor, { seed, userId })`
- `findInvalidBlueprintRunIds(executor, { limit? })`
- `deleteBlueprintRunsCascade(executor, runIds)`
- `cleanupInvalidBlueprintRuns(executor)`

The cleanup helper should be composable so it can be tested directly without relying only on table bootstrap side effects.

## Data Flow

### Persistent Run

1. frontend submits execution request with workflow and saved seed
2. backend validates that the seed is persistable for the current user
3. backend creates durable run record
4. backend executes steps and persists step state
5. backend writes final run state, artifact manifest, preview URL, and cancellation state as today
6. frontend may fetch history, detail, continue, or cancel by `runId`

### Ephemeral Run

1. frontend submits execution request with workflow that has no saved seed context
2. backend marks the run as non-persistent
3. backend emits `workflow-start` with `persistent: false` and no durable `runId`
4. backend executes the same workflow loop without durable run writes
5. frontend receives stream events and updates local runtime state
6. frontend skips history/detail/cancel persistence flows
7. when the page is refreshed or left, the ephemeral run disappears without leaving database residue

## Error Handling

- invalid or missing seed should not block execution by itself; it should only disable persistence
- persistence-disabled execution should not throw solely because history APIs are unavailable
- backend cancellation endpoint should keep returning `404` for unknown durable runs; frontend should avoid calling it for ephemeral runs
- cleanup failures should be logged clearly, but must not prevent Blueprint table initialization from succeeding unless the failure indicates data corruption that blocks safe operation
- if cleanup partially deletes step rows but fails before deleting run rows, the operation should roll back or retry as a single transactional unit
- the system should log when a run is intentionally executed in non-persistent mode so future debugging can distinguish policy from bugs

## Acceptance Criteria

The work is complete when all of the following are true:

- executing an unsaved Blueprint workflow creates no row in `blueprint_workflow_runs`
- executing an unsaved Blueprint workflow creates no row in `blueprint_workflow_run_steps`
- executing a saved Blueprint workflow still creates durable run and step history
- frontend execution UX still works for unsaved workflows in the current session
- frontend does not attempt durable run detail, history continuation, or cancel flows for ephemeral runs
- frontend receives an explicit persistent/non-persistent signal from the execution stream
- historical invalid Blueprint runs and their steps are deleted automatically
- cleanup is idempotent and does not delete valid saved-run history

## Testing Strategy

### Backend Policy Tests

- verify `executeBlueprintWorkflow(...)` does not call `createBlueprintRunRecord(...)` when seed is missing or not persistable
- verify step upserts are skipped for non-persistent runs
- verify a valid saved seed still persists run and step records
- verify cancellation-store reads and active-run registration occur only for persistent runs
- verify `workflow-start` marks ephemeral runs with `persistent: false`
- verify `workflow-start` marks durable runs with `persistent: true`

### Cleanup Tests

- verify cleanup removes runs with empty or `NULL` seeds
- verify cleanup removes runs whose owner has no valid saved relationship to the seed
- verify cleanup also deletes related `blueprint_workflow_run_steps`
- verify cleanup leaves valid source-owner runs intact
- verify cleanup leaves valid imported-copy runs intact
- verify running cleanup twice produces the same final database state
- verify cleanup executes transactionally for runs and steps

### Frontend Regression Tests

- verify unsaved execution no longer tries to hydrate `/blueprints/runs/:runId`
- verify route-leave auto-cancel only triggers persistent cancel requests
- verify saved runs still populate recent history normally
- verify ephemeral runs do not get appended into durable session history state

## Risks And Constraints

- some existing UI state assumes `latestRunId` always exists after execution starts; those assumptions need to be removed carefully
- automatic cleanup must use the same validity rules as execution persistence gating, or the system will drift
- making unsaved runs ephemeral means users lose refresh-time recoverability for those runs by design; that is consistent with the product rule
- bootstrap cleanup should remain bounded so it does not create noticeable startup latency on large history tables

## Next Step

After this spec is approved, write an implementation plan that covers repository cleanup helpers, run-service persistence gating, frontend degradation for ephemeral runs, and regression tests.
