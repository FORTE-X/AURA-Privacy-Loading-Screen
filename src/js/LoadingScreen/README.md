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
copy. A localized dark fade protects text contrast. The camera remains fixed at
the authored front view; orbiting, panning, and zooming are disabled.

A single efficient `THREE.Points` field adds soft particles around the central
torso. The particles use a bounded Brownian random walk, so they drift in varied
directions but remain gathered around the composition instead of escaping.
Starting any mouse or touch interaction scatters the field outward again without
moving the camera. Its bounded
volume then contracts over five seconds—twice the configured 2.5-second base
return duration—while Brownian motion continues.

`PrivacyBoxVisual.js` loads `assets/boxmain.glb` with its embedded base-color,
opacity, roughness, and emissive textures intact. It remains screen-anchored in
the upper-right while the central artwork animates, with a gentle hover and a
slow breath applied through the authored emissive material.
Its invisible `butterflyArrivalAnchor` is the destination hook for the incoming
privacy-detail butterflies. The authored 3.75-second vault clip is driven by
the same five-second transfer timeline as the butterflies rather than looping
independently. The arrival anchor is parented to the animated vault root and
targets the geometric center of the box, so the butterflies enter the center
even while the vault moves and opens.

`ButterflyStreamVisual.js` loads the authored pink and purple butterfly GLBs
once, then reuses their geometry, textures, and built-in animation clips. Four
small, differently sized butterflies flap and hover close to the woman while
facing inward. At five-second intervals, a larger pink-and-purple pair emerges
from behind the woman. They weave past one another, flap toward the box, shrink
into its arrival anchor, and leave a short colored glow as they disappear. Their
distance from the box continuously drives its brightness: the box grows
brighter as they approach, peaks at the opening, and dims back to its brighter
baseline breathing glow as they disappear. The vault animation begins 1.25
seconds into each flight, placing the 3.35-second butterfly arrival inside the
door's fully open interval; the door then closes during the arrival glow. The
safe box remains camera-anchored and does not inherit the woman's rotation.

The build copies everything in `assets/` to the same stable path under `dist`.
This avoids bundler-specific GLB URL rewriting and is the convention for future
authored loading-screen models.
