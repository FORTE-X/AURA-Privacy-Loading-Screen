# Change Log

This file records isolated feature work so changes can be reviewed before they are merged into `main` and published.

## Candidate: Phone-only bottom controls

Branch: `fix/mobile-only-bottom-controls`

Status: **Under review — not merged into `main` and not published to the primary live site.**

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
