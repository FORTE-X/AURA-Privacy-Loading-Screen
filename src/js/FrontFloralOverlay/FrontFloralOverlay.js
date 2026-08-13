import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const FLORAL_OVERLAY_COLOR = 0xe88cff;
export const FLORAL_OVERLAY_CORE_BRIGHTNESS = 1.35;
export const FLORAL_OVERLAY_OPACITY = 0.9;
export const FLORAL_OVERLAY_HEIGHT_RATIO = 0.94;
export const FLORAL_OVERLAY_SURFACE_OFFSET_RATIO = 0.025;

const FLOWER_ASSET_URL = new URL("./assets/b1.glb", import.meta.url).href;
const gltfLoader = new GLTFLoader();

let templatePromise = null;

/**
 * Places the authored floral composition as a single, front-facing layer.
 * Geometry is shared from one cached GLB load; only the glow material belongs
 * to each imported-model instance.
 */
export class FrontFloralOverlay {

    constructor(bounds, cutoffY) {

        if (!bounds || bounds.isEmpty()) {
            throw new Error("The floral overlay requires valid model bounds.");
        }

        if (!Number.isFinite(cutoffY)) {
            throw new Error("The floral overlay requires a valid portrait cutoff.");
        }

        this.bounds = bounds.clone();
        this.cutoffY = cutoffY;
        this.group = new THREE.Group();
        this.group.name = "Front Floral Glow Overlay";
        this.material = null;
        this.disposed = false;
        this.initializationId = 0;

    }

    get object3D() {

        return this.group;

    }

    async initialize() {

        if (this.disposed) return false;

        const initializationId = ++this.initializationId;
        const template = await loadFloralTemplate();

        if (this.disposed || initializationId !== this.initializationId) {
            return false;
        }

        const content = template.clone(true);
        const templateBounds = new THREE.Box3().setFromObject(content);

        if (templateBounds.isEmpty()) {
            throw new Error("The floral overlay asset contains no visible geometry.");
        }

        const templateSize = templateBounds.getSize(new THREE.Vector3());

        if (templateSize.y <= Number.EPSILON) {
            throw new Error("The floral overlay asset has an invalid height.");
        }

        const templateCenter = templateBounds.getCenter(new THREE.Vector3());
        const modelSize = this.bounds.getSize(new THREE.Vector3());
        const modelCenter = this.bounds.getCenter(new THREE.Vector3());
        const visibleHeight = this.bounds.max.y - this.cutoffY;
        const uniformScale = (
            visibleHeight * FLORAL_OVERLAY_HEIGHT_RATIO
        ) / templateSize.y;
        const surfaceOffset = Math.max(
            modelSize.z * FLORAL_OVERLAY_SURFACE_OFFSET_RATIO,
            modelSize.y * 0.002
        );

        this.material = createGlowMaterial(this.cutoffY);

        content.name = "Authored b1 Floral Arrangement";
        content.position.copy(templateCenter).multiplyScalar(-1);
        content.traverse((child) => {

            if (!child.isMesh) return;

            child.material = this.material;
            child.castShadow = false;
            child.receiveShadow = false;
            child.renderOrder = 9;

        });

        this.group.scale.setScalar(uniformScale);
        this.group.position.set(
            modelCenter.x,
            this.cutoffY + visibleHeight * 0.5,
            this.bounds.max.z + surfaceOffset
        );
        this.group.add(content);

        return true;

    }

    show() {

        this.group.visible = true;

    }

    hide() {

        this.group.visible = false;

    }

    toggle() {

        this.group.visible = !this.group.visible;
        return this.group.visible;

    }

    dispose() {

        if (this.disposed) return;

        this.disposed = true;
        this.initializationId++;
        this.group.removeFromParent();
        this.group.clear();
        this.material?.dispose();
        this.material = null;

    }

}

function loadFloralTemplate() {

    if (!templatePromise) {
        templatePromise = gltfLoader.loadAsync(FLOWER_ASSET_URL)
            .then((gltf) => {

                const template = gltf.scene;
                let meshCount = 0;

                template.traverse((child) => {

                    if (child.isMesh) meshCount++;

                });

                if (meshCount === 0) {
                    throw new Error("b1.glb contains no renderable meshes.");
                }

                template.updateMatrixWorld(true);
                return template;

            })
            .catch((error) => {

                templatePromise = null;
                throw new Error(
                    `Unable to load the front floral overlay: ${error.message}`
                );

            });
    }

    return templatePromise;

}

function createGlowMaterial(cutoffY) {

    const color = new THREE.Color(FLORAL_OVERLAY_COLOR)
        .multiplyScalar(FLORAL_OVERLAY_CORE_BRIGHTNESS);

    return new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: FLORAL_OVERLAY_OPACITY,
        depthTest: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
        clippingPlanes: [
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutoffY)
        ]
    });

}
