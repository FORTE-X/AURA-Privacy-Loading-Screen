import * as THREE from "three";

/**
 * Owns imported-model lifecycle state. It currently permits one active model,
 * while its array-based API is ready for future multi-model workflows.
 */
export class ModelManager {

    constructor(scene, camera, controls) {

        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.models = [];
        this.activeModel = null;
        this.listeners = new Set();
        this.cleanupHandlers = new Set();

    }

    addModel({
        model,
        file,
        cameraView,
        portraitPortal = null,
        glowingOutline = null
    }) {

        this.removeActiveModel();
        const modelContainer = new THREE.Group();

        modelContainer.name = "Imported Model Container";
        modelContainer.add(model);
        if (portraitPortal) modelContainer.add(portraitPortal.object3D);
        if (glowingOutline) modelContainer.add(glowingOutline.object3D);
        model.visible = true;

        const entry = {

            id: crypto.randomUUID(),
            model,
            modelContainer,
            fileName: file.name,
            fileType: file.name.split(".").pop().toUpperCase(),
            torsoMarker: null,
            portraitPortal,
            glowingOutline,
            cameraView: {

                position: cameraView.position.clone(),
                target: cameraView.target.clone()

            }

        };

        this.scene.add(modelContainer);
        this.models.push(entry);
        this.activeModel = entry;
        this.notify();

        return entry;

    }

    selectModel(id) {

        const entry = this.models.find((model) => model.id === id);

        if (!entry) return null;

        this.activeModel = entry;
        this.camera.position.copy(entry.cameraView.position);
        this.controls.target.copy(entry.cameraView.target);
        this.controls.update();
        this.notify();

        return entry;

    }

    removeActiveModel() {

        if (!this.activeModel) return false;

        return this.removeModel(this.activeModel.id);

    }

    removeModel(id) {

        const entry = this.models.find((model) => model.id === id);

        if (!entry) return false;

        this.cleanupHandlers.forEach((handler) => handler(entry));
        entry.portraitPortal?.dispose();
        entry.glowingOutline?.dispose();
        entry.torsoMarker?.dispose();
        this.scene.remove(entry.modelContainer);
        this.disposeModel(entry.model);

        this.models = this.models.filter((model) => model.id !== id);

        if (this.activeModel?.id === id) {

            this.activeModel = this.models[0] ?? null;

        }

        this.notify();

        return true;

    }

    subscribe(listener) {

        this.listeners.add(listener);
        listener(this.models, this.activeModel);

        return () => this.listeners.delete(listener);

    }

    addCleanupHandler(handler) {

        this.cleanupHandlers.add(handler);

        return () => this.cleanupHandlers.delete(handler);

    }

    getActiveModelContainer() {

        return this.activeModel?.modelContainer ?? null;

    }

    getActiveTorsoMarker() {

        return this.activeModel?.torsoMarker ?? null;

    }

    setTorsoMarker(id, marker) {

        const entry = this.models.find((model) => model.id === id);

        if (!entry) {

            marker.dispose();
            return false;

        }

        entry.torsoMarker?.dispose();
        entry.torsoMarker = marker;
        entry.modelContainer.add(marker.object3D);
        this.notify();

        return true;

    }

    toggleActiveTorsoMarker() {

        return this.activeModel?.torsoMarker?.toggle() ?? null;

    }

    notify() {

        this.listeners.forEach((listener) => {

            listener(this.models, this.activeModel);

        });

    }

    disposeModel(model) {

        const disposedGeometries = new Set();
        const disposedMaterials = new Set();
        const disposedTextures = new Set();

        model.traverse((child) => {

            if (!child.isMesh) return;

            if (child.geometry && !disposedGeometries.has(child.geometry)) {

                child.geometry.dispose();
                disposedGeometries.add(child.geometry);

            }

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

            materials.forEach((material) => {

                if (!material || disposedMaterials.has(material)) return;

                Object.values(material).forEach((value) => {

                    if (value?.isTexture && !disposedTextures.has(value)) {

                        value.dispose();
                        disposedTextures.add(value);

                    }

                });

                material.dispose();
                disposedMaterials.add(material);

            });

        });

    }

}
