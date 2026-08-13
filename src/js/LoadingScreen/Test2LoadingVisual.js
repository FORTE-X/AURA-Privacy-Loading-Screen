import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODEL_VIEW_HEIGHT_RATIO = 0.54;
export const MODEL_VERTICAL_POSITION = 0.75;
export const MODEL_FLOAT_AMPLITUDE = 0.045;
export const MODEL_FLOAT_SPEED = 0.55;
export const MODEL_TURN_AMPLITUDE = 0.045;
export const MODEL_TURN_SPEED = 0.32;
export const BOTTOM_GLOW_DIM_INTERVAL = 2;
export const BOTTOM_GLOW_DIM_DURATION = 0.42;
export const BOTTOM_GLOW_DIM_STRENGTH = 0.5;
export const BOTTOM_LIGHT_MAX_INTENSITY = 4.8;
export const BOTTOM_LIGHT_DISTANCE = 4;
export const BOTTOM_GLOW_MAX_OPACITY = 0.72;

const gltfLoader = new GLTFLoader();
const MODEL_URL = "./js/LoadingScreen/assets/test2.glb";

/** Preserves test2's authored material while adding restrained idle motion. */
export class Test2LoadingVisual {

    constructor(camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.name = "Test2 Authored Loading Visual";
        this.bottomLight = null;
        this.bottomGlow = null;
        this.disposed = false;
    }

    get object3D() {
        return this.group;
    }

    async initialize() {
        const gltf = await gltfLoader.loadAsync(MODEL_URL);

        if (this.disposed) {
            disposeObject3D(gltf.scene);
            return false;
        }

        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);

        if (bounds.isEmpty()) {
            disposeObject3D(model);
            throw new Error("test2.glb contains no visible geometry.");
        }

        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const cameraDistance = Math.abs(this.camera.position.z);
        const visibleHeight = 2 * Math.tan(
            THREE.MathUtils.degToRad(this.camera.fov) * 0.5
        ) * cameraDistance;
        const scale = visibleHeight * MODEL_VIEW_HEIGHT_RATIO /
            Math.max(size.y, Number.EPSILON);

        model.name = "test2.glb Textured Model";
        model.position.copy(center).multiplyScalar(-1);
        model.traverse((child) => {
            if (!child.isMesh) return;

            child.castShadow = false;
            child.receiveShadow = false;

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

            materials.forEach((material) => {
                if (!material) return;

                material.needsUpdate = true;
            });
        });

        this.bottomLight = new THREE.PointLight(
            0xef82ff,
            BOTTOM_LIGHT_MAX_INTENSITY,
            BOTTOM_LIGHT_DISTANCE,
            2
        );
        this.bottomLight.name = "Bright lower pulsing light";
        this.bottomLight.position.set(
            0,
            -size.y * 0.28,
            size.z * 0.72
        );

        this.bottomGlow = createBottomGlow();
        this.bottomGlow.position.set(0, -size.y * 0.32, size.z * 0.58);
        this.bottomGlow.scale.set(size.x * 1.55, size.y * 0.56, 1);

        this.group.scale.setScalar(scale);
        this.group.position.y = MODEL_VERTICAL_POSITION;
        this.group.add(model, this.bottomLight, this.bottomGlow);

        return true;
    }

    update(_deltaTime, elapsedTime) {
        if (this.disposed || this.group.children.length === 0) return;

        const floatWave = Math.sin(elapsedTime * MODEL_FLOAT_SPEED);
        const turnWave = Math.sin(elapsedTime * MODEL_TURN_SPEED);
        const glowCycleTime = elapsedTime % BOTTOM_GLOW_DIM_INTERVAL;
        const glowDimStart = BOTTOM_GLOW_DIM_INTERVAL -
            BOTTOM_GLOW_DIM_DURATION;
        const glowDimProgress = glowCycleTime >= glowDimStart
            ? (glowCycleTime - glowDimStart) / BOTTOM_GLOW_DIM_DURATION
            : 0;
        const glowDim = Math.sin(glowDimProgress * Math.PI) *
            BOTTOM_GLOW_DIM_STRENGTH;
        const glowBrightness = 1 - glowDim;

        this.group.position.y = MODEL_VERTICAL_POSITION +
            floatWave * MODEL_FLOAT_AMPLITUDE;
        this.group.rotation.y = turnWave * MODEL_TURN_AMPLITUDE;
        this.bottomLight.intensity = BOTTOM_LIGHT_MAX_INTENSITY *
            glowBrightness;
        this.bottomGlow.material.opacity = BOTTOM_GLOW_MAX_OPACITY *
            glowBrightness;
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        disposeObject3D(this.group);
        this.group.clear();
        this.bottomLight = null;
        this.bottomGlow = null;
    }
}

function createBottomGlow() {
    const canvas = document.createElement("canvas");
    const size = 256;
    const center = size * 0.5;

    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
    );

    gradient.addColorStop(0, "rgba(255, 235, 255, 1)");
    gradient.addColorStop(0.18, "rgba(250, 154, 255, 0.9)");
    gradient.addColorStop(0.5, "rgba(190, 68, 255, 0.42)");
    gradient.addColorStop(1, "rgba(112, 20, 190, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: BOTTOM_GLOW_MAX_OPACITY,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    const glow = new THREE.Sprite(material);

    glow.name = "Bright lower glow";
    glow.renderOrder = 10;
    return glow;
}

function disposeObject3D(object) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();

    object.traverse((child) => {
        if (!child.isMesh && !child.isSprite) return;

        if (child.geometry && !geometries.has(child.geometry)) {
            geometries.add(child.geometry);
            child.geometry.dispose();
        }

        const childMaterials = Array.isArray(child.material)
            ? child.material
            : [child.material];

        childMaterials.forEach((material) => {
            if (!material || materials.has(material)) return;

            Object.values(material).forEach((value) => {
                if (value?.isTexture && !textures.has(value)) {
                    textures.add(value);
                    value.dispose();
                }
            });

            materials.add(material);
            material.dispose();
        });
    });
}
