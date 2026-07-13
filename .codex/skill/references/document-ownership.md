# Document Ownership

Use owner documents to keep one current answer for every class of project information.

## Ownership Map

| Information | Owner | Other documents may contain |
| --- | --- | --- |
| purpose, scope, requirements, non-goals, success | `docs/01_PROJECT_BRIEF.md` | a link and one-sentence context |
| site identity, orientation evidence, source registry, hashes, attribution | `docs/02_SITE_AND_SOURCES.md` | source IDs and links |
| current numeric values, program requirements, spatial intent | `docs/03_DESIGN_BASIS.md` | field IDs and links |
| confirmed decisions, open questions, superseded claims, risks | `docs/04_DECISIONS_AND_OPEN_ITEMS.md` | DEC/OPEN IDs and links |
| schema, coordinates, geometry boundaries, Viewer/DXF acceptance | `docs/05_MODEL_AND_VIEWER_CONTRACT.md` | command or contract links |
| intake, change, validation, version, release workflow | `docs/06_WORKFLOW_AND_VERSIONING.md` | brief reminders and links |

`README.md` is only an entry point and status summary. `.codex/skill/` is only an execution procedure. Neither owns design facts.

## Editing Rules

1. Identify the fact type before editing.
2. Change the owner first.
3. Replace duplicated details elsewhere with a stable link or ID.
4. Keep a superseded statement in the decision history when its earlier use could explain an existing artifact.
5. Do not mark a decision confirmed merely because old code contains a constant.
6. Do not put implementation progress into the design basis.

## Resolving Conflicts

When two artifacts disagree:

1. Prefer an explicit recent user decision over a sketch or old implementation.
2. Prefer calibrated source evidence over visual guessing.
3. Treat unexplained historical geometry as legacy, not confirmation.
4. Add an OPEN item when no authoritative choice exists.
5. Record the superseded claim if it was previously documented as confirmed.

Do not resolve material design conflicts by silently choosing the easiest geometry to code.

## Refactor Check

After a documentation refactor:

- every current fact has one owner
- cross-references resolve
- DEC and OPEN IDs are unique
- no deleted document remains the only source of a live requirement
- historical Viewer links are labeled historical
- search results do not expose stale confirmed claims outside a clearly marked history section
