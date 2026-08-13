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
