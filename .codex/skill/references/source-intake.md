# Source Intake

Use this checklist whenever the user provides an image, plan, measurement, CAD file, note, map, or other evidence.

## 1. Preserve the source

- Copy the original bytes; do not resize, rotate, crop, annotate, or recompress the registered source.
- Use `source-materials/site/` for maps, aerial images, survey-like references, and site photos.
- Use `source-materials/concepts/` for sketches, mood images, diagrams, and concept drawings.
- Add new categories only when repeated sources justify them.

Naming pattern:

```text
SRC-<CATEGORY>-<NNN>_<short-kebab-description>.<extension>
```

Keep an existing ID stable. A changed file receives a new ID or explicit revision; never overwrite evidence behind an existing hash.

## 2. Record identity

Calculate and record:

- repository path
- file type and byte size when useful
- pixel dimensions for raster images
- SHA-256
- provider or author when known
- date received
- visible scale, compass, labels, legends, or annotations
- intended project use
- copyright or attribution context

Register these facts in `docs/02_SITE_AND_SOURCES.md`.

## 3. Separate observation from interpretation

Write observations first: visible roads, edges, labels, scale bars, arrows, rooms, or handwritten terms. Then write interpretations and their basis.

Do not claim that a sketch confirms a dimension merely because its shape appears proportional. Do not claim a satellite edge is a legal boundary. When identity or meaning is uncertain, record the uncertainty without discarding the source.

## 4. Route design impact

- A source registry change belongs only in `02_SITE_AND_SOURCES.md`.
- A new or revised numeric planning value belongs in `03_DESIGN_BASIS.md`.
- A user-confirmed choice or newly discovered conflict belongs in `04_DECISIONS_AND_OPEN_ITEMS.md`.
- A change to shared model behavior belongs in `docs/05_MODEL_CONTRACT.md`; output-specific behavior belongs in the affected `docs/contracts/` file.

Link between owners instead of copying the same explanation into all four.

## 5. Verify

- Recalculate the copied file hash and compare it to the registry.
- Open or inspect the copied file enough to catch corruption and wrong-file mistakes.
- Check case-sensitive repository paths even when working on Windows.
- Confirm the Git diff adds the binary once and does not accidentally include temporary derivatives.
