# AURA Privacy Experience

A responsive Three.js privacy-loading experience for AURA. Selecting a supported 3D model validates the file locally and activates an authored scene featuring a floral figure, animated butterflies, ambient particles, and a glowing privacy safe box.

## Live website

The GitHub Pages link will be added here after the new repository is published.

The interface adapts automatically:

- On phones, the controls become a compact bottom upload bar.
- On wider screens, the complete desktop sidebar is shown.
- Choosing **Desktop site** in a mobile browser gives the page a desktop-width viewport, so the desktop sidebar returns automatically.

## Privacy behavior

Selected model files remain on the device. The browser validates the file and keeps only its filename, format, size, and import time for the current session. The uploaded model itself is not displayed, analyzed, retained, or sent to a server.

## Supported files

- GLB 2.0
- GLTF
- OBJ
- FBX

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Parcel prints the local development address in the terminal.

## Production build

```bash
npm ci
npm run build
```

The optimized static website is written to `dist/`. Asset paths are relative, so the same build works from a GitHub Pages project URL.

## Deployment

Every push to `main` runs the GitHub Pages workflow in `.github/workflows/deploy-pages.yml`. It installs locked dependencies, builds the website, and publishes `dist/` over HTTPS.

## Project structure

```text
src/
  css/                  Responsive interface styling
  js/
    LoadingScreen/      Authored 3D privacy scene and assets
    ModelUpload/        Local file validation and upload controls
    scene.js             Three.js renderer, camera, and post-processing
    scripts.js           Application lifecycle
  index.html             Application shell
scripts/                 Production build helpers
```

## Team testing checklist

1. Open the live HTTPS link on desktop and confirm the left sidebar is visible.
2. Open the same link on a phone and confirm the compact bottom upload bar appears.
3. Select a supported model and confirm the privacy-loading scene starts.
4. On the phone, enable **Desktop site** and confirm the desktop sidebar returns.
