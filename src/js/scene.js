import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const viewport = document.getElementById("viewport");
const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;
const renderPixelRatio = Math.min(
    window.devicePixelRatio,
    isMobileViewport ? 1.25 : 2
);

export const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.FogExp2(0x06050b, 0.014);

export const camera = new THREE.PerspectiveCamera(
    48,
    viewport.clientWidth / viewport.clientHeight,
    0.1,
    1000
);

camera.position.set(5, 5, 5);

export const renderer = new THREE.WebGLRenderer({
    antialias: !isMobileViewport,
    alpha: true
});

renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
renderer.setPixelRatio(renderPixelRatio);
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = !isMobileViewport;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const environmentGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = environmentGenerator.fromScene(
    new RoomEnvironment(),
    0.04
).texture;
environmentGenerator.dispose();

viewport.appendChild(renderer.domElement);

export const composer = isMobileViewport
    ? null
    : new EffectComposer(renderer);

if (composer) {

    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(viewport.clientWidth, viewport.clientHeight),
        0.52,
        0.78,
        0.68
    );
    const outputPass = new OutputPass();

    composer.setPixelRatio(renderPixelRatio);
    composer.setSize(viewport.clientWidth, viewport.clientHeight);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

}

export function renderScene() {

    if (composer) {

        composer.render();
        return;

    }

    renderer.render(scene, camera);

}

export const controls = new OrbitControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;
controls.enablePan = false;
controls.enableRotate = false;
controls.enableZoom = false;
controls.enabled = false;
controls.target.set(0, 1, 0);

// Silhouette rig: a dark body held by narrow violet contour lights.
scene.add(new THREE.HemisphereLight(0x3c3248, 0x010103, 0.04));

const keyLight = new THREE.DirectionalLight(0xd5c6df, 0.34);
keyLight.position.set(-5, 11, 9);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.00015;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x654d79, 0.08);
fillLight.position.set(7, 6, 6);
scene.add(fillLight);

const frontLight = new THREE.DirectionalLight(0xb59ec6, 0.04);
frontLight.position.set(0, 5, 10);
scene.add(frontLight);

const rimLight = new THREE.DirectionalLight(0xe184ff, 1.6);
rimLight.position.set(-6, 8, -8);
scene.add(rimLight);

const coolRimLight = new THREE.DirectionalLight(0xa989d4, 0.75);
coolRimLight.position.set(7, 4, -6);
scene.add(coolRimLight);

const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({
        color: 0x000000,
        opacity: 0.38,
        transparent: true
    })
);
shadowCatcher.name = "Editorial Shadow Catcher";
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = -0.002;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

// Resize
window.addEventListener("resize", () => {

    camera.aspect =
        viewport.clientWidth /
        viewport.clientHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        viewport.clientWidth,
        viewport.clientHeight
    );

    composer?.setSize(
        viewport.clientWidth,
        viewport.clientHeight
    );

});
