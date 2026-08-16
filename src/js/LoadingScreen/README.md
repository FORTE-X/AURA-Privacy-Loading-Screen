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
interface. The large center dark fade has been removed so it no longer masks the
artwork. The privacy headline is anchored above the composition, while the
description, live status, progress line, and Capture / Encrypt / Secure sequence
are anchored below it with text shadows for contrast. On mobile, the desktop
sidebar and earlier bottom bar are removed; only a compact floating upload pill
appears before import, then disappears for the full-screen experience. Mobile
uses a dedicated paired layout: the woman is moderately smaller and contained
inside the left half, while the compact vault is anchored in the right half with
a deliberate gap so the two assets remain side by side without overlap. Mobile
also uses a tuned lower-resolution bloom pass, restoring the luminous vault,
flowers, butterflies, and particle trails without returning to the larger asset
sizes. The
camera remains fixed at the authored front view; orbiting, panning, and zooming
are disabled.

The earlier central particle cloud has been removed from the woman. Its single
efficient `THREE.Points` pool now forms a fading pink, lavender, and white trail
behind the transfer butterflies. Particles inherit a small amount of backward
flight velocity and Brownian drift, then fade naturally before the next cycle.

`PrivacyBoxVisual.js` loads `assets/boxmain.glb` with its embedded base-color,
opacity, roughness, and emissive textures intact. It remains screen-anchored in
the right half at the page centerline while the central artwork animates, with
a gentle hover and a slow breath applied through the authored emissive material.
Its display size is ten percent larger, and a restrained violet radial backdrop
echoes the vault palette without flattening the scene contrast.
Its invisible `butterflyArrivalAnchor` is the destination hook for the incoming
privacy-detail butterflies. The authored 3.75-second vault clip is driven by
the same five-second transfer timeline as the butterflies rather than looping
independently. The arrival anchor is parented to the animated vault root and
targets the geometric center of the box, so the butterflies enter the center
even while the vault moves and opens.

`ButterflyStreamVisual.js` loads the authored pink and purple butterfly GLBs
once, then reuses their geometry, textures, and built-in animation clips. Ten
small, differently sized butterflies flap in an asymmetric close halo around
the woman, with varied height, depth, and distance while still facing inward. A
restrained field of 96 desktop (58 mobile) pink and violet sparkles remains
around the figure between transfers. At five-second intervals, ten varied pink
and purple butterflies emerge from distinct areas across the upper torso,
sides, waist, and lower floral region. Individual launch delays, acceleration
curves, and arc offsets keep them at different distances and speeds across the
stream while synchronizing their final arrival with the open vault. They follow
wider perpendicular weaving paths, flap toward the box, shrink into its arrival
anchor, and leave a much denser single-draw-call field of luminous particle
trails plus a short colored glow as they disappear. Their
distance from the box continuously drives its brightness: the box grows
brighter as they approach, peaks at the opening, and dims back to its brighter
baseline breathing glow as they disappear. The vault animation begins 1.25
seconds into each flight, placing the 3.35-second butterfly arrival inside the
door's fully open interval; the door then closes during the arrival glow. The
safe box remains camera-anchored and does not inherit the woman's rotation.

The build copies everything in `assets/` to the same stable path under `dist`.
This avoids bundler-specific GLB URL rewriting and is the convention for future
authored loading-screen models.
