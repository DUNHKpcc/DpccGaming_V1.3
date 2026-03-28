# Blueprint Mode Static Redesign Spec

**Date:** 2026-03-28

**Scope:** Replace the current `/blueprint` page with a desktop-first, high-fidelity static redesign that matches the provided reference image while preserving a real infinite-canvas foundation for later node and connection work.

## Goal

Rebuild Blueprint Mode so the page visually matches the reference design as closely as practical, using the current route and page entry point. The result should feel like a clean, premium whiteboard editor with a left control rail, a top action bar, a large infinite canvas stage, a centered welcome card, and a bottom prompt input. This phase is intentionally limited to layout, styling, and foundational canvas behavior.

## Non-Goals

- Do not implement the real node workflow system in this phase.
- Do not implement production-ready connection rendering in this phase.
- Do not preserve the current Blueprint Mode dark workflow UI.
- Do not prioritize mobile design beyond avoiding obvious breakage.
- Do not add new visual ideas beyond the provided image.

## Route And Ownership

- Keep the existing route `/blueprint`.
- Continue using `src/views/BlueprintMode.vue` as the page entry.
- Remove or hide current Blueprint Mode UI elements that conflict with the approved design.
- Favor small internal component splits for clarity, but keep the route contract unchanged.

## Approved Product Boundaries

- This is a desktop-first high-fidelity static rebuild.
- The page should strictly follow the supplied design image.
- Existing Blueprint Mode elements not present in the design should be removed for now.
- Reuse shared game data and media parsing logic where practical.
- Do not force Account page visuals into Blueprint Mode.
- Infinite canvas logic must be real, not faked with a static background.

## Information Architecture

The page is composed of four fixed UI regions plus one world-space canvas region:

1. **Left Sidebar**
   - Brand block with DPCC GAMING and BluePrint&WorkFlow label.
   - Small square control button at top right of the brand row.
   - Three stacked action buttons: export JSON, import, clear workflow.
   - Model configuration section with four model pills and one “import own model” button.
   - Game library section with compact cards.
   - Seed field section.
   - Generation log box.
   - Bottom share button.

2. **Top Toolbar**
   - A horizontal row of rounded white buttons aligned near the top of the canvas area.
   - Buttons match the reference naming and order.
   - A small add button appears after the main tool set.
   - Right side contains a download/export icon button and a black run/play button.

3. **Canvas Stage**
   - Warm white background with subtle square grid lines.
   - Infinite panning and zooming world.
   - No visible hard canvas border.
   - Centered empty-state welcome card located in world coordinates, not viewport coordinates.

4. **Bottom Prompt Composer**
   - Fixed near the lower center of the viewport.
   - Wide rounded input field with placeholder text.
   - Black send button attached on the right.

5. **World-Centered Empty State**
   - A small logo card labeled “BluePrint”.
   - Main heading and muted instructional copy beneath.
   - Remains centered in the initial world position and moves correctly when panning.

## Visual Direction

The page must follow the supplied image rather than the existing project’s darker Blueprint styling.

### Core Visual Rules

- Use a warm off-white workspace background.
- Use very light gray borders and grid lines.
- Use black or near-black primary text.
- Use a muted gold/yellow accent for the Blueprint brand highlight.
- Use restrained shadows, mostly soft and shallow.
- Keep all surfaces clean, flat, and minimal.
- Preserve generous whitespace across the canvas.

### Spacing And Rhythm

- Left sidebar should feel narrow and dense, roughly matching the image proportions.
- Top toolbar should have comfortable horizontal gaps and compact vertical height.
- Main canvas must dominate the page visually.
- Input bar should sit low and centered with a calm floating feel.

### Fidelity Standard

When a design choice is ambiguous, prefer matching the image’s visual weight and proportions over inventing a new local pattern.

## Reuse Strategy

The implementation should reuse logic, not blindly reuse visuals.

### Reuse Allowed

- `src/stores/game.js` for loading and accessing game data.
- Existing media URL resolution and game metadata helpers where useful.
- Shared icon or asset lookup logic if already present elsewhere in the codebase.

### Reuse Not Required

- Account page library styling.
- Existing Blueprint Mode dark theme structure.
- Existing right-side inspector or current node card visuals.

### Recommended Extraction

Create shared utility-level helpers for:

- game cover resolution
- game video resolution
- code type icon resolution
- engine icon resolution

This keeps Blueprint and Account aligned on data/media behavior without forcing identical UI.

## Infinite Canvas Requirements

This phase does not need nodes, but the canvas foundation must be correct.

### World Model

- Maintain a world-space coordinate system for canvas contents.
- Maintain viewport translation and zoom state independently from fixed UI chrome.
- Position the welcome card in world space, not as a viewport overlay.

### Panning

- Users can drag on empty canvas space to pan.
- Panning moves grid, welcome card, and future world content together.
- Panning should feel smooth and immediate.

### Zooming

- Mouse wheel zooms the canvas.
- Zoom is anchored around the cursor position.
- Zooming affects world content and grid together.
- Zoom limits should prevent unusable extremes, but should not make the stage feel boxed in.

### Grid Rendering

- Grid must be dynamic and track translation plus scale.
- Do not use a fixed static background image for the grid.
- Grid line contrast must remain subtle.

### Fixed Layers

The following elements remain screen-fixed and must not zoom or pan:

- left sidebar
- top toolbar
- bottom prompt composer

## Static Interaction Requirements

Only light interactions are in scope for this phase.

### Required

- sidebar scrolling where content exceeds height
- hover states for sidebar cards and toolbar buttons
- focus state for the bottom input
- seed field display
- placeholder click feedback for non-implemented actions
- real pan and zoom on the canvas stage

### Explicitly Deferred

- true node creation
- true connection creation
- JSON import/export behavior
- workflow clearing behavior beyond placeholder action
- run/generate execution

## Removal List

The following current Blueprint Mode features should be removed or hidden in this phase:

- dark background theme
- current header with back button and old copy
- current right-side inspector panels
- current node prototype renderer
- current context menu
- current entry overlay modal
- current prompt box layout inside the left column
- current visible connection preview UI

## Implementation Shape

The page may be split into a few focused pieces, but it should stay easy to wire back into real behavior later.

### Suggested Internal Boundaries

- page shell and state assembly
- sidebar panel
- toolbar row
- canvas stage
- shared game library item presentation helper

These boundaries are for maintainability only and should not alter the approved visuals.

## Acceptance Criteria

The redesign is acceptable when all of the following are true:

- `/blueprint` opens into a desktop-first white Blueprint workspace that matches the reference image closely.
- The previous dark Blueprint Mode visual system is no longer visible.
- Left sidebar structure and top toolbar order match the approved image.
- The game library section uses live project game data or safe fallbacks.
- The center welcome card appears in the canvas stage at the correct initial position.
- The canvas can be panned and zoomed independently from the fixed UI layers.
- The grid tracks pan and zoom correctly.
- The page is visually clean and minimal, without extra sections not present in the image.

## Risks And Constraints

- Exact pixel parity may require a few iteration passes because the image is a screenshot, not a full design spec.
- Existing Blueprint Mode logic is intertwined with the current page and may need removal or temporary replacement to keep the redesign clean.
- Reuse should be constrained carefully so Account-specific visuals do not leak into Blueprint Mode.

## Next Phase After This Spec

After the static redesign is complete and stable, the next iteration should attach real node creation, node placement, and connection behavior to the already-correct world-space canvas foundation.
