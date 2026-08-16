# AURA Privacy Loading Screen

A polished Three.js privacy-loading experience for a local 3D model import
workflow. Importing a supported model triggers an authored scene featuring a
floral silhouette, animated butterflies, luminous transfer trails, and an
animated privacy vault.

## Highlights

- Fixed cinematic composition on desktop and mobile
- Authored textured GLB woman, flowers, butterflies, and animated vault
- Irregular ambient butterfly halo with subtle motion
- Staggered butterfly transfers synchronized to the opening vault
- Efficient single-draw-call glowing particle trails
- Capture, Encrypt, and Secure loading sequence
- Local-only model selection: the selected model is not displayed, uploaded,
  analyzed, modified, or retained

## Supported trigger files

- GLB and GLTF
- OBJ
- FBX

The selected file activates the visual experience. Only its basic filename,
format, size, and import time are used by the interface.

## Run locally

```bash
npm install
npm run dev
```

Parcel prints the local development address in the terminal.

## Production build

```bash
npm run build
```

The optimized static site is generated in `dist/`.

## Project structure

- `src/index.html` — application interface
- `src/css/style.css` — desktop and mobile presentation
- `src/js/LoadingScreen/` — authored Three.js loading scene
- `src/js/ModelUpload/` — local file-selection lifecycle
- `scripts/` — production build helpers

## Privacy

Selected model files remain on the user's device. The application does not
send them to a server.
