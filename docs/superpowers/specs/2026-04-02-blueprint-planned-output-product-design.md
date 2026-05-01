# Blueprint Planned Output Product Spec

**Date:** 2026-04-02

**Scope:** Change Blueprint `Planned` mode so the terminal output node produces a browser-previewable finished mini-game instead of a generic run-summary template, remove Playwright-based browser validation from this path, and make output generation fail rather than silently falling back to default placeholder files.

## Goal

The current Blueprint planned flow can end in a technically runnable bundle that is still only a wrapper template. That behavior is misleading because the preview opens successfully while the user expectation is a playable game deliverable.

The updated behavior should treat the output node as a product generator, not a document renderer.

Success means:

- the final output node generates a single-page browser game that can be previewed directly
- the generated game includes a complete loop: start, play, end or fail, and restart
- the system retries generation with targeted repair instructions when the first output is incomplete
- the system no longer fabricates a default preview bundle after model output fails
- Playwright-based browser smoke validation is removed from the Blueprint planned execution path

## Non-Goals

- Do not redesign the Blueprint canvas, toolbar, or node visuals in this phase.
- Do not change how planning nodes are laid out on the canvas unless required by the output contract.
- Do not introduce a framework-based runtime; the output remains plain `index.html`, `style.css`, `game.js`, and `README.md`.
- Do not guarantee that every generated game is high quality or genre-perfect; this phase only tightens the minimum finished-product contract.
- Do not add a new external build pipeline, bundler, or dependency installation step for generated output.

## Product Decisions

### Planned Mode Targets A Finished Mini-Game

The final output node in `Planned` mode should now be judged as a finished mini-game artifact rather than a bundle of placeholder files.

The minimum finished-game contract is:

- `index.html` renders a real game shell, not a run summary page
- `style.css` styles the game UI and gameplay states rather than generic artifact cards
- `game.js` initializes gameplay and manages runtime state
- the game supports a visible start state
- the game supports active play with user input and state changes
- the game reaches an end or fail state
- the game provides a restart path without page reload

This contract intentionally defines behavior rather than only file presence.

### Failure Is Preferable To Fake Success

Today the backend writes fallback files when model output is missing or incomplete. That produces a preview URL even when the generator did not succeed.

That fallback must be removed for Blueprint output bundles.

New rule:

- if the output node cannot produce a bundle that satisfies the finished-game contract after the allowed repair attempts, the node fails
- failed output generation should not create a replacement preview bundle
- preview URLs should point only to model-generated bundles that passed the contract validation

### Automatic Repair Stays, But Becomes Product-Oriented

The retry loop remains useful and should stay, but the repair feedback needs to focus on missing product behaviors rather than abstract formatting mistakes.

Examples of repair issues:

- missing start screen or start action
- no gameplay state transition after start
- no end or fail condition
- no restart action after completion or failure
- missing `#app` mount root
- missing script or stylesheet wiring
- interaction exists visually but does not update game state in code structure

### Remove Playwright Validation From This Flow

Browser smoke validation via Playwright should be removed from the Blueprint execution flow for planned mini-game output.

Reasons:

- the requested behavior is to trust the contract-based generation path rather than block success on Playwright runtime checks
- this path currently adds complexity and a separate failure mode that the user does not want
- the system should determine success from generation contract validation rather than a browser automation pass

The execution flow should therefore stop after contract validation and bundle writing.

## Architecture Changes

### Output Prompt Contract

File:
[backend/utils/blueprintNodeHandlers.js](backend/utils/blueprintNodeHandlers.js)

The output-node prompt must shift from “generate four files” to “generate a playable browser mini-game with a complete loop.”

The prompt should explicitly require:

- plain HTML, CSS, and JavaScript only
- no third-party dependencies
- a visible start state before gameplay begins
- active gameplay driven by user input
- an end or fail state caused by gameplay
- a restart action available after ending
- `index.html` loading `style.css` and `game.js`
- an `id="app"` mount node
- `README.md` documenting gameplay, controls, file structure, and run instructions

The prompt should also forbid:

- run-summary dashboards
- step-report pages
- placeholder copy that only describes a hypothetical game
- static screens without state transitions

### Contract Validation Becomes Product Validation

File:
[backend/utils/blueprintNodeHandlers.js](backend/utils/blueprintNodeHandlers.js)

The current file-bundle validation should be tightened into a finished-product validator.

The validator should still check file presence, but also inspect the generated text for minimum game structure signals.

Minimum validation rules:

- all required files exist and are non-empty
- `index.html` references `style.css` and `game.js`
- `index.html` contains `id="app"`
- `game.js` contains an initialization path that mounts into `#app`
- `game.js` contains distinct state concepts for at least start, play, and end or fail
- `game.js` contains a restart trigger or restart handler
- generated UI text or code structure suggests actual player interaction, not just narration
- `README.md` includes `## 玩法`, `## 操作`, `## 结构`, and `## 运行`

This validation is intentionally heuristic. It does not need to prove perfect gameplay correctness, but it must reject obvious templates and fake success cases.

### Repair Loop Gets More Specific

File:
[backend/utils/blueprintNodeHandlers.js](backend/utils/blueprintNodeHandlers.js)

The repair loop should continue to reuse previous files, but the retry instructions need to include the failed product checks in plain language.

Recommended behavior:

- increase the repair budget beyond the current single retry
- pass prior files back to the model for incremental repair
- enumerate failed contract checks directly in the repair prompt
- keep the final node status as `failed` if the repair budget is exhausted

### Bundle Writing Must Reject Fallback Templates

File:
[backend/utils/blueprintArtifacts.js](backend/utils/blueprintArtifacts.js)

`writeBlueprintRunBundle` should only write files that were actually generated and validated.

It must stop creating default `index.html`, `style.css`, `game.js`, and `README.md` replacements for Blueprint run bundles.

New behavior:

- if any required file content is missing at bundle-write time, throw an error instead of substituting default files
- the legacy default-template helpers can be removed from this Blueprint path
- `manifest.json` remains generated by the backend because it is metadata, not user-facing game content

### Execution Flow No Longer Runs Browser Smoke Checks

File:
[backend/controllers/blueprintController.js](backend/controllers/blueprintController.js)

After the output bundle is validated and written:

- keep manifest generation
- keep preview URL generation
- remove `validateBlueprintRunBundleBrowser(...)`
- remove the post-write failure branch that converts the run back into a failed state based on Playwright smoke results
- stop appending browser-validation analysis into output-node runtime

This simplifies success semantics: passed contract plus written bundle equals successful preview artifact.

## Data Flow

The revised planned-output flow should be:

1. Blueprint execution reaches the output node
2. upstream node results are normalized into `gameSpec`
3. the model generates the four output files under the finished-game contract
4. backend validates the files against the product contract
5. if validation fails, backend retries with targeted repair instructions and prior files
6. if validation eventually passes, backend writes the bundle and manifest and returns the preview URL
7. if validation never passes, the output node fails and no fallback preview bundle is produced

## Error Handling

- if the model returns invalid JSON, the output node should treat that as a repairable generation failure and retry within budget
- if the model returns files that are present but clearly template-like, validation should fail with explicit issues
- if bundle writing is attempted with missing required files, the backend should throw rather than substituting placeholders
- if output generation fails after all repair attempts, the run should fail at the output node and surface the failed contract issues in analysis or error messaging
- if no preview artifact exists because generation failed, the client should show the failed run state rather than a stale or fabricated preview

## Acceptance Criteria

The work is complete when all of the following are true:

- a successful Blueprint planned run ends with a real previewable browser mini-game rather than a run-summary template
- the generated output satisfies the minimum loop of start, play, end or fail, and restart
- output-node retries use targeted product-failure repair messages
- the backend no longer writes default fallback game files for Blueprint run bundles
- the backend no longer runs Playwright browser smoke validation for Blueprint planned output
- a failed output generation does not expose a fake success preview URL

## Testing Strategy

### Contract Tests

- verify a valid four-file playable bundle passes validation
- verify bundles missing `#app` fail validation
- verify bundles missing a restart path fail validation
- verify bundles that resemble summary templates fail validation
- verify README section omissions fail validation

### Execution Tests

- verify output generation retries when the first response is incomplete
- verify exhausted retries produce a failed output node
- verify successful output writes the bundle and preview URL
- verify failed output does not write substitute default files

### Regression Checks

- verify non-output Blueprint nodes continue to execute as before
- verify manifest generation still works for successful bundles
- verify existing preview URL wiring in the client still works for successful runs

## Risks And Constraints

- heuristic validation can reject some creative but valid game structures if the checks are too rigid
- removing the fallback template will increase visible failure rate, but that is aligned with the product decision to avoid fake success
- removing Playwright validation reduces runtime certainty, so the product contract needs to be explicit enough to compensate
- prompt tightening can improve minimum quality but will not fully eliminate model variance

## Next Step

After this spec is approved, write an implementation plan covering:

- output prompt and validation contract changes
- bundle writer changes removing default fallbacks
- execution-flow cleanup removing Playwright smoke validation
- automated tests for contract validation and bundle writing behavior
