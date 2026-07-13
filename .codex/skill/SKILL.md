---
name: swimming-pool-design
description: Maintain and develop this Swimming Pool Design repository with traceable source intake, owner-document governance, explicit design decisions, a single parameter model, and trustworthy Viewer/DXF validation. Use when adding site or concept references, revising dimensions or spatial intent, resolving open design questions, refactoring project documents, implementing the TypeScript/Three.js Viewer, generating DXF, or checking whether outputs match the current design basis.
---

# Swimming Pool Design

Use this skill as the repository working procedure. Do not copy project facts into this file; read them from their owner documents.

## Start Every Task

1. Read `README.md` for current phase and historical artifact boundaries.
2. Read only the owner documents needed for the task:
   - project scope: `docs/01_PROJECT_BRIEF.md`
   - site, orientation, and evidence: `docs/02_SITE_AND_SOURCES.md`
   - current values and spatial intent: `docs/03_DESIGN_BASIS.md`
   - decisions and unresolved questions: `docs/04_DECISIONS_AND_OPEN_ITEMS.md`
   - model, Viewer, and DXF behavior: `docs/05_MODEL_AND_VIEWER_CONTRACT.md`
   - workflow and releases: `docs/06_WORKFLOW_AND_VERSIONING.md`
3. Inspect `git status` and preserve unrelated user changes.
4. Classify the request as source intake, design decision, document change, model change, Viewer/DXF implementation, or validation.

## Apply Authority Rules

- Treat the six owner documents as current authority; treat V02/V03 artifacts as history unless a document explicitly promotes a value.
- Never infer a confirmed answer for an item listed as open or deferred.
- Represent a needed but unresolved geometry as missing data or a visibly distinct deferred zone.
- Display design dimensions as numeric values. Keep source, basis, status, and revision in model metadata.
- Keep orientation, units, dimensions, and version data centralized. Do not hard-code separate values in the Viewer and DXF exporter.
- If documents conflict, stop model implementation at the conflicting field, record the conflict in the decisions owner, and continue only with unaffected work.

## Route Work

### Add a source

Read [references/source-intake.md](references/source-intake.md). Preserve the original file, generate its hash, register it in the source owner, and separate observed evidence from design interpretation.

### Change or decide the design

Read [references/document-ownership.md](references/document-ownership.md). Update the DEC/OPEN state first, then the design basis, then model data and outputs. Preserve superseded decisions instead of silently rewriting history.

### Build or modify the model, Viewer, or DXF

Read `docs/05_MODEL_AND_VIEWER_CONTRACT.md` completely, then read [references/model-validation.md](references/model-validation.md). Implement from the single validated model and keep geometry builders independent of DOM and file loading.

### Refactor documentation

Read [references/document-ownership.md](references/document-ownership.md). Move facts to their owner, replace duplicates with links, and verify that the refactor does not change confirmed meaning.

## Complete the Task

1. Run the checks proportional to the change.
2. For source or document changes, verify links, hashes, owner placement, and contradictions.
3. For model or Viewer changes, run schema, unit, build, browser smoke, and visual checks from [references/model-validation.md](references/model-validation.md).
4. Confirm `git diff --check` passes.
5. Report what changed, what was validated, which open decisions remain, and the exact Demo entry point when one exists.

Do not call a historical Viewer the current Demo. Do not mark work complete merely because a 3D scene renders; completion requires the trust indicators and validation contract to pass.
