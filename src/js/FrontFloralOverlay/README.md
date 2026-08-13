# Front floral overlay

This feature loads `assets/b1.glb` once and reuses its authored geometry as a
front-facing ornamental layer for every imported scan. The arrangement is
uniformly scaled to the visible portrait height, placed slightly in front of
the scan, and rendered with a violet-pink glow material.

Easy visual tuning is exposed at the top of `FrontFloralOverlay.js`:

- `FLORAL_OVERLAY_COLOR`
- `FLORAL_OVERLAY_CORE_BRIGHTNESS`
- `FLORAL_OVERLAY_OPACITY`
- `FLORAL_OVERLAY_HEIGHT_RATIO`
- `FLORAL_OVERLAY_SURFACE_OFFSET_RATIO`

The GLB geometry is never deformed or randomized. The overlay is parented to
the imported model container and is disposed automatically with that model.
