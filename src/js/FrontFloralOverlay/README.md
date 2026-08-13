# Front floral overlay

This feature loads `assets/b1.glb` once and reuses its authored geometry as a
front-facing ornamental layer for every imported scan. Five texture-free focal
flower assets are placed at fixed normalized design coordinates over that vine
foundation. Model pose and limb locations never alter the composition.

The flowers use vertex-color gradients (ivory centre, pink middle, lavender
edge) plus restrained bloom and subtle deterministic motion. Their original
GLBs remain untouched outside the project; `scripts/strip-glb-textures.mjs`
creates compact geometry-only copies because the runtime gradient replaces the
five identical embedded texture sets.

Easy visual tuning is exposed at the top of `FrontFloralOverlay.js`:

- `FLORAL_VINE_OPACITY`
- `FLORAL_FLOWER_OPACITY`
- `FLORAL_OVERLAY_HEIGHT_RATIO`
- `FLORAL_OVERLAY_SURFACE_OFFSET_RATIO`
- `FLORAL_FLOWER_HOVER_STRENGTH`
- `FLORAL_FLOWER_SWAY_STRENGTH`
- `FLORAL_FLOWER_PULSE_STRENGTH`

The GLB geometry is never deformed or randomized. The overlay is parented to
the imported model container and is disposed automatically with that model.
