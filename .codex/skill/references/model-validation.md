# Model and Viewer Validation

Choose checks proportional to the change, but never skip data validation because the scene looks correct.

## Data Integrity

- schema and model versions are present and supported
- units are metres and coordinate semantics are declared
- every geometry-driving value has provenance
- working and confirmed dimensions are finite and positive
- deferred values correspond to an OPEN ID
- no fallback silently replaces missing design data
- source IDs exist in the source registry

## Geometry Invariants

- deep depth is greater than shallow depth and the pool floor slopes in the intended direction
- pool and water surfaces remain inside the valid pool hall boundary
- preferred lane count can be evaluated against pool width
- glass roof projection intersects only the pool hall zone
- service zones do not overlap the pool volume
- north rotation is applied once, not once per builder
- generated dimensions equal model values within the declared numeric tolerance

## Viewer Behavior

- initial load shows a deliberate camera angle and a visible model
- orbit, pan, zoom, reset, top, perspective, and elevation views work
- layer controls reflect actual visibility state
- north indicator and model version remain visible
- dimension labels use the declared units
- deferred zones look different and can be hidden
- loading, schema, and geometry failures show an error state instead of a plausible fallback model
- controls remain usable at desktop and mobile viewport widths

## Viewer/DXF Agreement

- both outputs contain the same model version and revision
- building and pool extents match
- north direction and units match
- major dimensions match
- deferred geometry is either excluded or placed on a clearly named deferred layer

## Recommended Commands

Once the Viewer toolchain exists, maintain scripts with these stable meanings:

```powershell
npm run dev
npm run build
npm run test
npm run test:e2e
```

`test` should cover schema and geometry invariants. `test:e2e` should cover browser loading, controls, viewport sizes, visible trust indicators, and a small set of stable screenshots.

## Manual Visual Review

Inspect at least top, standard perspective, and two opposite elevations. Check roof scope, slope meaning, pool depth direction, service volume, orientation, label overlap, transparency order, camera clipping, and mobile control layout.

Record any mismatch as a defect or OPEN item. A screenshot is evidence of rendering, not proof that dimensions or orientation are correct.
