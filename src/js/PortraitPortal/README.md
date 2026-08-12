# Portrait Portal

Creates a reference-proportioned portal beneath each imported portrait:

- a compact bright inner pool;
- a faint finishing aura across the complete portal footprint;
- six thin, subtly noise-varied animated ripple lines;
- a short surface-conforming reflection over the lowest part of the model.

The lower reflection is vertex-colored duplicate surface geometry, not a
rectangular sprite, so it cannot expose a straight texture boundary. Tune the
exported `PORTAL_*` constants in `PortraitPortal.js`.
