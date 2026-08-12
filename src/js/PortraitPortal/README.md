# Portrait Portal

Creates the soft portal disk and animated ripple rings beneath the portrait.
The light rising from it is applied as vertex-colored geometry directly over
the lower surface of the imported model, rather than as a rectangular sprite.

This keeps the body light-absorbing everywhere else and avoids visible glow
texture boundaries. Tune the exported `PORTAL_*` constants in
`PortraitPortal.js`.
