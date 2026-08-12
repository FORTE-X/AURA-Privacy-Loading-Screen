# Glowing Outline

Creates an inverted-hull contour for each newly imported body scan. It clones
the source mesh geometry, expands vertices along their normals, and renders
only the back faces with an additive violet material.

The outline is a sibling of the source model inside `modelContainer`, so it
does not affect torso analysis and is disposed with the imported model.

Tune `OUTLINE_THICKNESS_RATIO`, `OUTLINE_OPACITY`, `OUTLINE_COLOR`, and
`OUTLINE_GLOW_STRENGTH` in `InvertedHullOutline.js`.
