import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const viewport = document.getElementById("viewport");
const mobileViewport = window.matchMedia("(max-width: 760px)").matches;
const pixelRatio = Math.min(window.devicePixelRatio, mobileViewport ? 1.25 : 2);

export const ORBIT_TARGET_Y = 0.75;
export const ORBIT_HORIZONTAL_LIMIT = THREE.MathUtils.degToRad(18);
export const ORBIT_VERTICAL_LIMIT = THREE.MathUtils.degToRad(12);
export const ORBIT_ROTATE_SPEED = 0.38;

export const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.FogExp2(0x050309, 0.02);

const ambientLight = new THREE.HemisphereLight(0x9e83b0, 0x08050d, 0.5);
const keyLight = new THREE.DirectionalLight(0xffe8f7, 1.05);
const violetRimLight = new THREE.DirectionalLight(0xa978ff, 0.8);

keyLight.position.set(-3, 5, 6);
violetRimLight.position.set(4, 2, -3);
scene.add(ambientLight, keyLight, violetRimLight);

export const camera = new THREE.PerspectiveCamera(
    42,
    viewport.clientWidth / viewport.clientHeight,
    0.1,
    100
);
camera.position.set(0, ORBIT_TARGET_Y, 7);

export const renderer = new THREE.WebGLRenderer({
    antialias: !mobileViewport,
    alpha: true,
    powerPreference: "high-performance"
});
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, ORBIT_TARGET_Y, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.enableZoom = false;
controls.rotateSpeed = ORBIT_ROTATE_SPEED;
controls.minAzimuthAngle = -ORBIT_HORIZONTAL_LIMIT;
controls.maxAzimuthAngle = ORBIT_HORIZONTAL_LIMIT;
controls.minPolarAngle = Math.PI * 0.5 - ORBIT_VERTICAL_LIMIT;
controls.maxPolarAngle = Math.PI * 0.5 + ORBIT_VERTICAL_LIMIT;
controls.update();

export const composer = mobileViewport ? null : new EffectComposer(renderer);

if (composer) {
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(viewport.clientWidth, viewport.clientHeight),
        0.42,
        0.72,
        0.72
    );
    const outputPass = new OutputPass();

    composer.setPixelRatio(pixelRatio);
    composer.setSize(viewport.clientWidth, viewport.clientHeight);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
}

export function renderScene() {
    controls.update();

    if (composer) {
        composer.render();
        return;
    }

    renderer.render(scene, camera);
}

export function disposeSceneControls() {
    controls.dispose();
}

window.addEventListener("resize", () => {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer?.setSize(width, height);
});
