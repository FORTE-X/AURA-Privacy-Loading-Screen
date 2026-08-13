import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODEL_VIEW_HEIGHT_RATIO = 0.54;
export const MODEL_VERTICAL_POSITION = 0.75;
export const MODEL_FLOAT_AMPLITUDE = 0.045;
export const MODEL_FLOAT_SPEED = 0.55;
export const MODEL_TURN_AMPLITUDE = 0.045;
export const MODEL_TURN_SPEED = 0.32;
export const BOTTOM_GLOW_BREATH_DURATION = 3;
export const BOTTOM_GLOW_BREATH_STRENGTH = 0.08;

const gltfLoader = new GLTFLoader();
const MODEL_URL = "./js/LoadingScreen/assets/test2.glb";

/** Preserves test2's authored material while adding restrained idle motion. */
export class Test2LoadingVisual {

    constructor(camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.name = "Test2 Authored Loading Visual";
        this.emissiveMaterials = [];
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

                if (material.emissiveMap) {
                    this.emissiveMaterials.push({
                        material,
                        baseIntensity: material.emissiveIntensity
                    });
                }
            });
        });

        this.group.scale.setScalar(scale);
        this.group.position.y = MODEL_VERTICAL_POSITION;
        this.group.add(model);

        return true;
    }

    update(_deltaTime, elapsedTime) {
        if (this.disposed || this.group.children.length === 0) return;

        const floatWave = Math.sin(elapsedTime * MODEL_FLOAT_SPEED);
        const turnWave = Math.sin(elapsedTime * MODEL_TURN_SPEED);
        const glowBreath = Math.sin(
            elapsedTime * Math.PI * 2 / BOTTOM_GLOW_BREATH_DURATION
        );
        const emissiveIntensity = 1 + glowBreath *
            BOTTOM_GLOW_BREATH_STRENGTH;

        this.group.position.y = MODEL_VERTICAL_POSITION +
            floatWave * MODEL_FLOAT_AMPLITUDE;
        this.group.rotation.y = turnWave * MODEL_TURN_AMPLITUDE;
        this.emissiveMaterials.forEach(({ material, baseIntensity }) => {
            material.emissiveIntensity = baseIntensity * emissiveIntensity;
        });
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        disposeObject3D(this.group);
        this.group.clear();
        this.emissiveMaterials.length = 0;
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
