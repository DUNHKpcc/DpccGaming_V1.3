# Blueprint Entry And Node Runtime Spec

**Date:** 2026-04-01

**Scope:** Refine the `/blueprint` entry experience and node runtime UX by removing the sidebar seed center, moving recent-blueprint access into the empty-state homepage, making node execution visibly readable while AI is thinking, fixing node editor panel sizing, and persisting AI-generated final text back into node content when saving.

## Goal

Make Blueprint feel like a usable workspace rather than a hidden technical editor.

The updated experience should solve four concrete problems:

- users cannot tell that AI is actively working on a node unless they inspect it closely
- the current seed entry UI occupies persistent sidebar space even though it is primarily a workflow bootstrap action
- there is no homepage-style recent-blueprint entry when the canvas is empty
- node editor panels grow with content instead of staying fixed and scrollable
- saving a blueprint does not persist the AI-generated final text that users expect to keep as node content

## Non-Goals

- Do not redesign the entire Blueprint shell, toolbar, or canvas visual language in this phase.
- Do not persist full runtime history such as `summary`, `analysis`, `progressTrail`, or generated files inside the saved workflow model.
- Do not remove server-side seed support or blueprint loading by seed.
- Do not invent a separate dashboard route for recent blueprints.
- Do not change the underlying DAG execution model.

## Product Decisions

### Remove Sidebar Seed Center

The left sidebar should stop being the primary entry point for seed operations.

- remove the dedicated “种子” section from `BlueprintSidebar`
- keep workflow actions that are still editing-oriented, such as import, export, clear, and model selection
- move “load an existing blueprint” capability into the empty-state homepage instead of the sidebar

This keeps the sidebar focused on authoring tools rather than startup and retrieval actions.

### Empty Canvas Becomes Homepage

When the canvas has no nodes, the stage empty state should act like a lightweight Blueprint homepage.

- preserve the existing “start building by dragging a game in” guidance
- add a separate “最近蓝图” section below or beside the hero guidance inside the empty state
- include a lightweight entry for loading an existing blueprint without requiring the old sidebar seed input

Once the canvas contains any node, this homepage disappears and the standard canvas experience resumes.

## Recent Blueprint Homepage

### Data Source

The recent-blueprint list should use the existing blueprint-related data that is already available before inventing a new data contract.

- first preference: use a dedicated recent-blueprints response if the existing backend already exposes one
- fallback: derive a minimal recent list from existing blueprint run history and known blueprint metadata
- if only seeds and timestamps are available, ship a minimal card layout rather than blocking the feature

The first implementation should prefer practical completeness over ideal metadata richness.

### Card Content

Each recent-blueprint card should show the most stable metadata available:

- blueprint identifier, preferring a human title if one exists, otherwise seed
- last updated or last run time
- node count when available
- a primary `打开` action

If preview media is available later it can be added, but it is not required for this phase.

### Open Behavior

- opening a recent blueprint from an empty canvas loads it immediately
- opening a recent blueprint while the current canvas has content must reuse the existing replacement-confirmation flow
- loading must route through the same workflow hydration path as current seed imports so graph parsing stays unified

## Node Runtime Visibility

Execution state must become visible at a glance without forcing the user to open a node panel.

### In-Node Running State

When a node is executing:

- keep the existing progress panel
- also add a clearer in-node runtime treatment that explicitly communicates “AI 正在思考” or equivalent running state
- ensure the state is readable from normal zoom levels and not only through small chips
- allow the node body to show the latest progress detail when available

This treatment should be stronger than the current subtle running chip, but it must still fit the existing Blueprint visual system.

### Editor Panel Running State

The node editor panel header should reflect the same runtime state as the node itself.

- if the node is running, the panel header must show an obvious running badge
- runtime tabs stay available
- the currently active runtime panel should remain readable while updates stream in

## Node Editor Panel Layout

The node editor panel should become a fixed-size floating modal-like panel with internal scrolling.

### Layout Rules

- panel width is fixed within the Blueprint scale system
- panel height is fixed within the Blueprint scale system
- header remains fixed
- footer actions remain fixed
- the middle content area scrolls vertically

### Scroll Behavior

Both editing and runtime inspection must scroll inside the panel instead of stretching it.

- the editable textarea should live in a bounded region
- runtime tab panels should use fixed inner heights with `overflow-y: auto`
- long text, long analysis, and file contents should scroll inside the panel body
- file tabs may wrap or horizontally scroll, but file content must stay inside the fixed panel shell

This change should prevent the panel from covering large portions of the canvas as content grows.

## Saving AI Final Text Back Into Nodes

### Approved Persistence Rule

The saved workflow model should persist only the AI-generated final text, not the full runtime snapshot.

- `node.content` remains the canonical persisted text field for compact nodes
- when a node finishes execution and yields a usable final text output, that text should be eligible to become the node’s persisted content
- when the user saves the blueprint, the workflow payload should include the latest finalized node content after this runtime-to-content merge

### What Counts As Final Text

The implementation should treat the node’s user-facing final textual result as the source of truth for persistence.

- prefer `runtime.output` when it is a non-empty string
- do not persist transient fields such as `progressDetail`
- do not persist structured runtime metadata such as `summary`, `analysis`, `retryCount`, or `browserValidation`
- do not persist generated file bundles into node content

### Writeback Timing

To avoid mismatches between what the user sees and what gets saved, the system should write back in two places:

1. on node execution completion, update that node’s in-memory `content` with the finalized output text when appropriate
2. before saving the full blueprint workflow, run one final normalization pass that merges any remaining finalized runtime outputs into `node.content`

The second pass exists as a safety net. The primary user-visible effect should happen immediately after node completion.

### Node-Type Boundary

This writeback behavior applies only to text-oriented compact nodes whose editable body is `content`.

- compact prompt and spec nodes are in scope
- game source nodes are out of scope
- if an output node yields a file bundle rather than plain final text, do not blindly overwrite its `content`

The implementation should use explicit guards rather than assuming every runtime has safe text output.

## Data Flow

The updated save flow should look like this:

1. user runs one or more nodes
2. runtime events update `nodeRuntimeMap`
3. completed text-producing nodes also update their corresponding `blueprintNodes[].content`
4. user saves blueprint
5. save path performs a final runtime-to-content merge
6. serialized workflow persists nodes and edges only

This keeps the saved model simple while preserving the user-expected AI output.

## Error Handling

- if recent-blueprint loading fails, the empty-state homepage should degrade gracefully and still allow starting a new workflow
- if the recent-blueprint API is unavailable, show an empty-state fallback message rather than blocking the page
- if a runtime output is absent, empty, or non-textual, do not overwrite existing node content
- if loading a recent blueprint would replace a dirty canvas, use the existing confirmation guard instead of silently replacing content

## Acceptance Criteria

The work is complete when all of the following are true:

- the sidebar no longer shows the old seed section
- the empty canvas shows a recent-blueprint homepage section
- users can open a recent blueprint from the empty state
- node execution clearly indicates AI running status without opening the node
- node editor panels stay fixed-size while long content scrolls internally
- saving a blueprint persists AI-generated final text into applicable node `content`
- reopening a saved blueprint shows the persisted final text in those node editors
- full runtime history is not embedded into the saved workflow JSON

## Testing Strategy

### Functional Checks

- verify an empty canvas shows the homepage-style recent-blueprint section
- verify a non-empty canvas hides that homepage content
- verify opening a recent blueprint hydrates nodes and edges correctly
- verify opening a recent blueprint from a dirty canvas triggers replacement confirmation

### Runtime Checks

- verify a running node displays an obvious thinking state on the node body
- verify the node editor panel header reflects running status
- verify runtime tabs continue updating while execution events stream in

### Persistence Checks

- verify a completed text-producing node updates visible editor content in memory
- verify saving after execution persists that text in exported and reloaded workflow data
- verify nodes without textual output do not lose their prior content

### Layout Checks

- verify the node editor panel height remains stable with long input text
- verify process and result tabs scroll internally
- verify file content scrolls inside the panel and does not stretch the shell

## Risks And Constraints

- recent-blueprint richness depends on what metadata the existing backend exposes; the UI must tolerate minimal payloads
- immediate runtime-to-content writeback can surprise users if it overwrites manually edited unsaved draft text, so writeback should target canonical node state only after execution completion, not an actively typed draft buffer
- output nodes may produce structured bundles rather than plain text, so persistence rules must stay explicit per node/runtime shape

## Next Step

After this spec is approved, the next step is to write an implementation plan that splits the work into:

- empty-state recent-blueprint entry changes
- sidebar seed removal and workflow access adjustments
- node runtime visibility improvements
- fixed-size editor panel layout changes
- runtime-to-content persistence updates and regression checks
