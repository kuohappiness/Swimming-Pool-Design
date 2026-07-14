# Document Ownership Adapter

The formal and current ownership contract is [docs/governance/DOCUMENT_OWNERSHIP.md](../../../docs/governance/DOCUMENT_OWNERSHIP.md). Read it before moving facts, changing DEC／OPEN／TASK state, or refactoring documents. Do not reproduce its owner map here.

## Repository Procedure

1. Classify the information before editing.
2. Change the formal owner first.
3. Replace duplicated details elsewhere with an ID and link.
4. Preserve a superseded DEC when it explains an existing artifact.
5. Use OPEN only when the answer still needs material input; use TASK when the answer or fix is known.
6. Put implementation progress only in `docs/07_ACTIVE_WORK.md`.
7. Move completed or superseded specs to `docs/archive/specs/`; never append active work to an archived plan.

## Conflict Handling

1. Prefer an explicit recent user decision over a sketch or old implementation.
2. Prefer calibrated evidence over visual guessing.
3. Treat unexplained historical geometry as legacy, not confirmation.
4. If no authoritative choice exists, add an OPEN item and stop only the affected implementation.
5. If the answer is known but the artifact is stale, record a TASK rather than another OPEN.

After a refactor, run `npm run check:docs`, the model validator, applicable tests, build, and `git diff --check`.
