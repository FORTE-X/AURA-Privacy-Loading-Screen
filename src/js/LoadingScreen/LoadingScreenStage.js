import * as THREE from "three";

/** Owns only project-authored loading-screen models and animations. */
export class LoadingScreenStage {

    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.name = "AURA Loading Screen Models";
        this.animations = new Set();
        this.disposables = new Set();
        this.initialized = false;
        this.disposed = false;
    }

    initialize() {
        if (this.initialized || this.disposed) return;

        this.initialized = true;
        this.scene.add(this.group);
    }

    addModel(model, { update = null, owned = true } = {}) {
        if (this.disposed || !model?.isObject3D) return false;

        this.group.add(model);
        if (typeof update === "function") this.animations.add(update);
        if (owned) this.disposables.add(model);

        return true;
    }

    update(deltaTime, elapsedTime) {
        if (!this.initialized || this.disposed) return;
        this.animations.forEach((update) => update(deltaTime, elapsedTime));
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.animations.clear();
        this.disposables.forEach(disposeObject3D);
        this.disposables.clear();
        this.group.removeFromParent();
        this.group.clear();
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
