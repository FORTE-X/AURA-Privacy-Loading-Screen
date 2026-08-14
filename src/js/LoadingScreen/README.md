# Loading screen stage

This folder is the clean foundation for AURA's authored 3D loading screen.

`LoadingScreenStage` owns only project-supplied scene models and their small
animation callbacks. It has no upload controls, imported body scans, torso
analysis, markers, garment fitting, portal fitting, or model modification.

Future GLB models should be placed in an `assets` folder here and integrated
through a dedicated module in this folder. Register each model with
`addModel(model, { update })` so its animation and disposal remain contained.

## Current visual

`Test3LoadingVisual.js` loads `assets/test3main2.glb` with its embedded figure
and flower textures unchanged. It fits the full composition to the loading-screen
camera and adds a slow float and very small turn to the complete design.

The 13 separately authored flower objects keep their original placement. Each
receives a deterministic, subtly varied hover and sway plus a restrained
pink/lavender emissive color breath that feeds the existing bloom pass. The
compact lower light remains at the model's cut-off edge and briefly dims to 50%
every two seconds.

The full authored composition is allowed to extend behind the lower loading
copy. A localized dark fade protects text contrast. Camera orbit stays locked
to the artwork at a fixed distance, with panning and zoom disabled and narrow
horizontal and vertical rotation limits.

A single efficient `THREE.Points` field adds soft particles around the central
torso. The particles use a bounded Brownian random walk, so they drift in varied
directions but remain gathered around the composition instead of escaping.
Starting any mouse or touch orbit scatters the field outward again. Its bounded
volume then contracts over five seconds—twice the configured 2.5-second base
return duration—while Brownian motion continues.

`PrivacyBoxVisual.js` loads `assets/boxmain.glb` with its embedded base-color,
opacity, roughness, and emissive textures intact. It remains screen-anchored in
the upper-right while the central artwork is orbited, with a gentle hover, a
small sway, and a slow breath applied through the authored emissive material.
Its invisible `butterflyArrivalAnchor` is the destination hook for the incoming
privacy-detail butterflies that will be added in the next iteration.

The build copies everything in `assets/` to the same stable path under `dist`.
This avoids bundler-specific GLB URL rewriting and is the convention for future
authored loading-screen models.
