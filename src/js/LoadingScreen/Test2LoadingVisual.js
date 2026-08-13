import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODEL_VIEW_HEIGHT_RATIO = 0.54;
export const MODEL_VERTICAL_POSITION = 0.75;
export const MODEL_FLOAT_AMPLITUDE = 0.045;
export const MODEL_FLOAT_SPEED = 0.55;
export const MODEL_TURN_AMPLITUDE = 0.045;
export const MODEL_TURN_SPEED = 0.32;
export const LOWER_LIGHT_BREATH_DURATION = 6;
export const LOWER_LIGHT_MIN_INTENSITY = 3.6;
export const LOWER_LIGHT_MAX_INTENSITY = 4.8;
export const LOWER_LIGHT_DISTANCE = 4;

const gltfLoader = new GLTFLoader();
const MODEL_URL = "./js/LoadingScreen/assets/test2.glb";

/** Preserves test2's authored material while adding restrained idle motion. */
export class Test2LoadingVisual {

    constructor(camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.name = "Test2 Authored Loading Visual";
        this.lowerBreathingLight = null;
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

        this.lowerBreathingLight = new THREE.PointLight(
            0xef82ff,
            LOWER_LIGHT_MAX_INTENSITY,
            LOWER_LIGHT_DISTANCE,
            2
        );
        this.lowerBreathingLight.name = "Lower breathing light";
        this.lowerBreathingLight.position.set(
            0,
            -size.y * 0.24,
            size.z * 0.75
        );

        this.group.scale.setScalar(scale);
        this.group.position.y = MODEL_VERTICAL_POSITION;
        this.group.add(model, this.lowerBreathingLight);

        return true;
    }

    update(_deltaTime, elapsedTime) {
        if (this.disposed || this.group.children.length === 0) return;

        const floatWave = Math.sin(elapsedTime * MODEL_FLOAT_SPEED);
        const turnWave = Math.sin(elapsedTime * MODEL_TURN_SPEED);
        const lightBreath = 0.5 - 0.5 * Math.cos(
            elapsedTime * Math.PI * 2 / LOWER_LIGHT_BREATH_DURATION
        );

        this.group.position.y = MODEL_VERTICAL_POSITION +
            floatWave * MODEL_FLOAT_AMPLITUDE;
        this.group.rotation.y = turnWave * MODEL_TURN_AMPLITUDE;
        this.lowerBreathingLight.intensity = THREE.MathUtils.lerp(
            LOWER_LIGHT_MAX_INTENSITY,
            LOWER_LIGHT_MIN_INTENSITY,
            lightBreath
        );
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        disposeObject3D(this.group);
        this.group.clear();
        this.lowerBreathingLight = null;
    }
}

function disposeObject3D(object) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();

    object.traverse((child) => {
        if (!child.isMesh) return;

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
