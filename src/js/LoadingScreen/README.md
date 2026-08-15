# Loading screen stage

This folder is the clean foundation for AURA's authored 3D loading screen.

`LoadingScreenStage` owns only project-supplied scene models and their small
animation callbacks. It has no upload controls, imported body scans, torso
analysis, markers, garment fitting, portal fitting, or model modification.

Future GLB models should be placed in an `assets` folder here and integrated
through a dedicated module in this folder. Register each model with
`addModel(model, { update })` so its animation and disposal remain contained.

The screen is started by `ModelUpload/ModelUploadController.js`. That controller
validates a local GLB, GLTF, OBJ, or FBX file and records only its filename,
format, size, and import time. The uploaded model is deliberately not displayed,
modified, analyzed, or retained; a successful local import simply triggers this
authored privacy-loading experience. Removing or replacing the imported entry
disposes the current loading scene before another one can begin.

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
opacity, and roughness textures intact. Its emissive contribution is disabled,
so the box remains visible without adding bloom to the scene. It stays
screen-anchored opposite the central artwork with a gentle hover.
Its invisible `butterflyArrivalAnchor` is the destination hook for the incoming
privacy-detail butterflies.

`ButterflyStreamVisual.js` loads the authored pink and purple butterfly GLBs
once, then reuses their geometry, textures, and built-in animation clips. Four
small, differently sized butterflies flap and hover close to the woman while
facing inward. At five-second intervals, a larger pink-and-purple pair emerges
from behind the woman. They weave past one another, flap toward the box, shrink
into its arrival anchor, and leave a short colored glow as they disappear. The
safe box remains camera-anchored, does not glow, and does not inherit the
woman's rotation.

The build copies everything in `assets/` to the same stable path under `dist`.
This avoids bundler-specific GLB URL rewriting and is the convention for future
authored loading-screen models.
