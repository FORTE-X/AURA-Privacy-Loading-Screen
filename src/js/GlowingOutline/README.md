# Glowing Outline

Creates a two-layer inverted-hull contour for each newly imported body scan.
It clones the source mesh geometry, expands vertices along their normals, and
renders only the back faces. A narrow bright shell defines the contour while a
wider, faint shell spreads violet light away from the black silhouette.

The outline is a sibling of the source model inside `modelContainer`, so it
does not affect torso analysis and is disposed with the imported model.

Tune the `OUTLINE_*` exports in `InvertedHullOutline.js` to control the core
line and wider halo thickness, opacity, color, and glow strength.
