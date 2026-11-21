# Viewer visual model provenance

`TASK-063` does not ship external GLTF binaries. Its planting, human-scale, and
equipment cues are project-authored procedural geometry created by
`rendering/enhanced/visual-asset-adapter.ts`, anchored to the `SITE-01` visual
bounds, and marked `visualOnly` / `collisionExcluded`.

Any future external model added here must first be registered in the visual
asset manifest with source, author, license, hash, byte size, quality tier, and
required/optional loading behavior. Model transforms remain presentation data
and must never become canonical geometry or collision input.
