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

The build copies everything in `assets/` to the same stable path under `dist`.
This avoids bundler-specific GLB URL rewriting and is the convention for future
authored loading-screen models.
