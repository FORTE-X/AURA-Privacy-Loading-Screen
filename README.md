# Aura Silhouette

Aura Silhouette is an interactive Three.js viewer for importing body scans, estimating the torso, and visualizing torso markers and anatomical guides.

## Live website

[Open Aura Silhouette](https://forte-x.github.io/aura-silhouette-site/)

The HTTPS website works on desktop and mobile browsers. Use the upload control to select a supported model file from your device.

## Privacy

Imported models are processed locally inside the browser. The current application does not upload selected model files to a server.

## Supported formats

- GLB and GLTF
- OBJ
- FBX

## Local development

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```
