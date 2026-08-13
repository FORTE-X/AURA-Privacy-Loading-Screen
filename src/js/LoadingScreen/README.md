# Loading screen stage

This folder is the clean foundation for AURA's authored 3D loading screen.

`LoadingScreenStage` owns only project-supplied scene models and their small
animation callbacks. It has no upload controls, imported body scans, torso
analysis, markers, garment fitting, portal fitting, or model modification.

Future GLB models should be placed in an `assets` folder here and integrated
through a dedicated module in this folder. Register each model with
`addModel(model, { update })` so its animation and disposal remain contained.

## Current visual

`Test2LoadingVisual.js` loads `assets/test2.glb` with all four embedded texture
maps unchanged. It fits the model to the loading-screen camera and adds only a
slow float and a very small turn. Its authored emissive gradient retains a
stable base level. A separate bright lower light and gradient remain steady,
briefly dim to 50% every two seconds, and smoothly return. The light is kept
compact and positioned at the model's lower cut-off edge.

The build copies everything in `assets/` to the same stable path under `dist`.
This avoids bundler-specific GLB URL rewriting and is the convention for future
authored loading-screen models.
