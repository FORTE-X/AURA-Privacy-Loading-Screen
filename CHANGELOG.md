# Change Log

This file records isolated feature work so changes can be reviewed before they are merged into `main` and published.

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
- Removed the rear upward aura, rising beam, and lower-front wash after their
  sprite boundaries produced a visible line; the portal now retains only its
  soft disk and feathered ripple rings.
- Removed the remaining portal disk and ripple rings as well, leaving no lower
  glow or horizontal portal lines in the portrait scene.
- Restored the portal disk and ripples, then replaced the old front/back glow
  sprites with a vertex-colored surface layer that rises smoothly over the
  model's lower body without a rectangular boundary.

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
