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

## Architecture Changes

### Introduce A Single Persistence Gate

Files:
[backend/services/blueprint/blueprintRunService.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/backend/services/blueprint/blueprintRunService.js)
[backend/repositories/blueprintRepository.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/backend/repositories/blueprintRepository.js)

Run persistence should be decided once near the beginning of execution, before any run record is created.

Recommended shape:

- add a repository/service helper that resolves whether a given `{ seed, userId }` pair is persistable
- return a structured result such as `{ shouldPersist, normalizedSeed, sourceExists, hasUserCopy, isSourceOwner }`
- use that helper inside `executeBlueprintWorkflow(...)`

That helper becomes the single policy source for:

- whether to call `createBlueprintRunRecord(...)`
- whether to call `upsertBlueprintRunStepRecord(...)`
- whether cancellation-state reads should hit the store

### Keep Execution Logic Shared Across Persistent And Ephemeral Runs

File:
[backend/services/blueprint/blueprintRunService.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/backend/services/blueprint/blueprintRunService.js)

The core execution loop should still run for both cases. The difference is whether persistence side effects are enabled.

Suggested behavior:

- derive `persistRun` before execution starts
- only allocate `runId` and register active run control if `persistRun` is true
- guard every persistence write behind `persistRun`
- keep stream payload shape compatible, but allow `runId` to be empty for ephemeral runs

This avoids duplicating execution logic while making persistence policy explicit.

### Make Cancellation Logic Persistence-Aware

Files:
[backend/services/blueprint/blueprintRunService.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/backend/services/blueprint/blueprintRunService.js)
[src/composables/blueprint/useBlueprintExecution.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/src/composables/blueprint/useBlueprintExecution.js)
[src/views/BlueprintMode.vue](/Users/dpccskisw/Documents/DpccProject/DpccGaming/src/views/BlueprintMode.vue)

Current leave/cancel behavior assumes every active run has a durable `runId`. That assumption must stop.

New rules:

- if the current execution is ephemeral, frontend cancel only aborts the fetch stream locally
- if the current execution is persistent, existing `/runs/:runId/cancel` behavior remains
- auto-cancel on route leave should only call the backend when the current run is persistent
- run-history hydration should be skipped when no durable `runId` exists

The UI should still surface that execution stopped; it just should not attempt persistence APIs that cannot succeed.

### Clean Historical Invalid Runs Automatically

Files:
[backend/repositories/blueprintRepository.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/backend/repositories/blueprintRepository.js)
[backend/services/blueprint/blueprintCommon.js](/Users/dpccskisw/Documents/DpccProject/DpccGaming/backend/services/blueprint/blueprintCommon.js)

The backend needs an idempotent cleanup pass for historical invalid data.

Rows should be considered invalid and deleted when either condition is true:

- `blueprint_workflow_runs.seed` is empty or `NULL`
- run seed no longer maps to a valid saved Blueprint context for the owning user:
  - no matching source row for that seed, or
  - no matching user copy and the run owner is not the source owner

Cleanup order:

1. identify invalid run ids
2. delete matching rows from `blueprint_workflow_run_steps`
3. delete matching rows from `blueprint_workflow_runs`

This cleanup should be safe to execute multiple times and should leave valid persisted runs untouched.

Recommended trigger:

- execute cleanup as part of Blueprint table readiness/bootstrap, after table creation succeeds
- keep the cleanup bounded to Blueprint tables only

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
3. backend executes the same workflow loop without durable run writes
4. frontend receives stream events and updates local runtime state
5. frontend skips history/detail/cancel persistence flows
6. when the page is refreshed or left, the ephemeral run disappears without leaving database residue

## Error Handling

- invalid or missing seed should not block execution by itself; it should only disable persistence
- persistence-disabled execution should not throw solely because history APIs are unavailable
- backend cancellation endpoint should keep returning `404` for unknown durable runs; frontend should avoid calling it for ephemeral runs
- cleanup failures should be logged clearly, but must not prevent Blueprint table initialization from succeeding unless the failure indicates data corruption that blocks safe operation

## Acceptance Criteria

The work is complete when all of the following are true:

- executing an unsaved Blueprint workflow creates no row in `blueprint_workflow_runs`
- executing an unsaved Blueprint workflow creates no row in `blueprint_workflow_run_steps`
- executing a saved Blueprint workflow still creates durable run and step history
- frontend execution UX still works for unsaved workflows in the current session
- frontend does not attempt durable run detail, history continuation, or cancel flows for ephemeral runs
- historical invalid Blueprint runs and their steps are deleted automatically
- cleanup is idempotent and does not delete valid saved-run history

## Testing Strategy

### Backend Policy Tests

- verify `executeBlueprintWorkflow(...)` does not call `createBlueprintRunRecord(...)` when seed is missing or not persistable
- verify step upserts are skipped for non-persistent runs
- verify a valid saved seed still persists run and step records
- verify cancellation-store reads and active-run registration occur only for persistent runs

### Cleanup Tests

- verify cleanup removes runs with empty or `NULL` seeds
- verify cleanup removes runs whose owner has no valid saved relationship to the seed
- verify cleanup also deletes related `blueprint_workflow_run_steps`
- verify cleanup leaves valid source-owner runs intact
- verify cleanup leaves valid imported-copy runs intact
- verify running cleanup twice produces the same final database state

### Frontend Regression Tests

- verify unsaved execution no longer tries to hydrate `/blueprints/runs/:runId`
- verify route-leave auto-cancel only triggers persistent cancel requests
- verify saved runs still populate recent history normally

## Risks And Constraints

- some existing UI state assumes `latestRunId` always exists after execution starts; those assumptions need to be removed carefully
- automatic cleanup must use the same validity rules as execution persistence gating, or the system will drift
- making unsaved runs ephemeral means users lose refresh-time recoverability for those runs by design; that is consistent with the product rule

## Next Step

After this spec is approved, write an implementation plan that covers repository cleanup helpers, run-service persistence gating, frontend degradation for ephemeral runs, and regression tests.
