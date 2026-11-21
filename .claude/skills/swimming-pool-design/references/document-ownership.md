# Document Ownership Adapter

The formal and current ownership contract is [docs/architecture.md](../../../../docs/architecture.md). Read it before moving facts, changing DEC／OPEN／TASK state, or refactoring documents. Do not reproduce its owner map here.

## Repository Procedure

1. Classify the information before editing.
2. Change the formal owner first.
3. Replace duplicated details elsewhere with an ID and link.
4. Preserve a superseded DEC when it explains an existing artifact.
5. Use OPEN only when the answer still needs material input; write a task document when the answer or fix is known. When an OPEN is answered, move it to 〈已轉出〉 in `docs/backlog.md` with a `→` line to where it went.
6. Put a task's state only in the status line under the title of its `docs/tasks/` document, and copy it into its `docs/roadmap.md` row in the same commit; `npm run check:docs` compares the two.
7. Keep finished task documents in `docs/tasks/` and only change their status line; never add new files to `docs/archive/specs/` or append active work to an archived plan.

## Conflict Handling

1. Prefer an explicit recent user decision over a sketch or old implementation.
2. Prefer calibrated evidence over visual guessing.
3. Treat unexplained historical geometry as legacy, not confirmation.
4. If no authoritative choice exists, add an OPEN item and stop only the affected implementation.
5. If the answer is known but the artifact is stale, record a TASK rather than another OPEN.

After a refactor, run `npm run check:docs`, the model validator, applicable tests, build, and `git diff --check`.
