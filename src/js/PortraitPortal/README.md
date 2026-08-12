# Portrait Portal

Creates the soft portal disk and animated ripple rings beneath the portrait.
The light rising from it is applied as vertex-colored geometry directly over
the lower surface of the imported model, rather than as a rectangular sprite.

The portal also uses a bright inner pool, a wide finishing aura, and thin
procedurally varied ripple textures so the rings do not look mechanically
uniform.

This keeps the body light-absorbing everywhere else and avoids visible glow
texture boundaries. Tune the exported `PORTAL_*` constants in
`PortraitPortal.js`.
