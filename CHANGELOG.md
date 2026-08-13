# Change Log

This file records isolated feature work so changes can be reviewed before they are merged into `main` and published.

## Offline iteration: Reference-matched portrait lighting

Status: **Saved locally; not published.**

Changes:

- Rebalanced the portal using the supplied silhouette artwork as a proportional
  reference rather than maximizing glow intensity.
- Enlarged the portal footprint, added a compact bright inner pool, and used
  six thin noise-varied ripples over a faint full-area aura.
- Replaced rectangular lower-glow sprites with a short surface-conforming fade.
- Reduced model reflections and tightened the violet outline and halo.

## Offline iteration: Inverted-hull silhouette outline

Status: **Saved locally; not published.**

Changes:

- Duplicated each imported mesh into an independently owned outline shell.
- Expanded outline vertices along their actual vertex normals.
- Rendered only the shell's back faces for an anime-style violet contour.
- Kept the outline outside the analyzed model so torso estimation is unchanged.
- Matched the portrait clipping plane and imported-model lifecycle.
- Added configurable thickness, opacity, color, and glow strength.
- Verified consistent outline thickness on two differently proportioned scans.
- Darkened the source material further and increased outward outline bloom so
  the body reads as a light-absorbing void surrounded by violet energy.
- Added a localized portal wash over the lower front of the silhouette while
  preserving the black, light-absorbing material everywhere else.

## Candidate: Phone-only bottom controls

Branch: `fix/mobile-only-bottom-controls`

Status: **Approved and merged into `main`; production publication verified on August 7, 2026.**

Changes:

- Limited the compact bottom toolbar to screens `760px` wide or narrower.
- Restored the complete sidebar on desktop browsers, desktop webviews, and wider tablets.
- Removed coarse-pointer detection so touch-capable computers retain the desktop layout.

## Candidate: Mobile bottom controls

Branch: `feature/mobile-bottom-controls`

Status: **Approved and merged into `main`; production publication verified on August 7, 2026.**

Changes:

- Replaced the full mobile sidebar with a compact fixed bottom bar.
- Kept only Upload, Pause/Resume Rotation, and Reset View on mobile.
- Expanded the mobile 3D viewport to use all space above the bottom bar.
- Added safe-area spacing for phones with gesture/navigation insets.
- Added a broader mobile/coarse-pointer breakpoint for phones that report large CSS viewport widths.
- Preserved the complete desktop sidebar and all desktop controls.
- Preserved model importing, torso estimation, markers, rotation, camera controls, and removal behavior.
- Reset View now restores the model's original front-facing import rotation as well as the camera.

Decision options:

- Keep: merge this branch into `main`, then publish it.
- Revise: continue editing this branch without affecting `main`.
- Discard: switch back to `main` and delete this branch.
# Offline iteration: front floral glow overlay

- Added the authored `b1.glb` arrangement as a fixed front-facing floral layer.
- Preserved the asset geometry and its original composition without randomizing
  or deforming it.
- Added cached loading, uniform portrait-relative scaling, violet-pink glow,
  portrait clipping, and imported-model lifecycle cleanup.
- Added five fixed focal flower models with ivory-pink-lavender vertex-color
  gradients and subtle hover, sway, pulse, and centre-glow animation.
- Made the composition pose-independent and changed portrait framing to ignore
  extreme arm span, so A-pose and T-pose scans keep the same visual design.
- Removed five duplicate embedded texture sets from the runtime flower copies,
  reducing their combined size from about 25 MB to about 138 KB.
# Offline reset: authored loading screen

- Removed body-scan importing and the model-manager interface.
- Removed torso analysis, torso markers, landmarks, portal fitting, glowing
  scan outlines, and the pose-dependent floral overlay pipeline.
- Removed every runtime asset used by the previous imported-model design.
- Added a clean full-screen loading interface and a dedicated lifecycle stage
  for future project-authored GLB models and their lightweight animations.
# Offline iteration: first authored loading model

- Added `test2.glb` as the central loading-screen visual.
- Preserved its embedded base-color, roughness, specular, and emissive maps.
- Added soft neutral/violet stage lighting, responsive camera fitting, gentle
  floating and turning, and restrained emissive breathing.
- Kept the authored lower emissive gradient at a stable base brightness and
  changed its animation to one smooth, low-amplitude breath every three seconds.
- Kept the lower glow steady between events and changed its timing to one smooth
  50% dim-and-return every two seconds.
- Restored the distinct bright magenta lower light and its visible gradient;
  only this dedicated light now performs the two-second 50% dim cycle while the
  GLB's authored emissive texture remains steady.
- Reduced the restored light's intensity and spread, then moved it from the
  pelvis to the model's lower cut-off edge.
- Increased the compact bottom glow's visible intensity by 50% without changing
  its placement, spread, or dimming rhythm.

# Offline iteration: authored model with flowers

- Replaced `test2.glb` with the supplied `test3main2.glb` loading-screen model.
- Preserved the embedded figure and flower textures and the authored flower
  arrangement.
- Added independent deterministic hover and sway to all 13 flower objects.
- Added subtle pink/lavender emissive color breathing so the flowers animate
  through the existing bloom treatment without changing the main figure.

# Offline iteration: full-frame constrained orbit

- Enlarged the complete authored 3D composition to fill more of the screen and
  intentionally continue behind the lower loading copy.
- Added a compact feathered dark layer behind the copy to preserve legibility.
- Added fixed-distance camera orbit centered on the artwork, disabled zoom and
  panning, and limited viewing to 18 degrees sideways and 12 degrees vertically.

# Offline iteration: central Brownian particles

- Added one efficient glowing particle field around the center of the model.
- Added deterministic Brownian motion, drag, and soft center attraction so the
  particles wander naturally while remaining inside a compact 3D volume.
- Reduced the particle count on mobile while retaining the same visual style.
- Enlarged the Brownian motes and increased their opacity so individual
  particles remain clearly visible around the floral silhouette.
- Made every mouse or touch orbit scatter the particles outward again.
- Added a five-second recovery—twice the configured base return duration—during
  which the particle boundary smoothly contracts back around the model center.
- Tripled the Brownian particle diameter and doubled the field to 184 particles
  on desktop and 112 on mobile.
