import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const PRIVACY_BOX_SCREEN_X_DESKTOP = 0.44;
export const PRIVACY_BOX_SCREEN_X_MOBILE = 0.36;
export const PRIVACY_BOX_SCREEN_Y_DESKTOP = -0.18;
export const PRIVACY_BOX_SCREEN_Y_MOBILE = -0.14;
export const PRIVACY_BOX_SCREEN_HEIGHT_DESKTOP = 0.22;
export const PRIVACY_BOX_SCREEN_HEIGHT_MOBILE = 0.17;
export const PRIVACY_BOX_CAMERA_DISTANCE = 4.2;
export const PRIVACY_BOX_HOVER_AMPLITUDE = 0.008;
export const PRIVACY_BOX_HOVER_SPEED = 1.05;
export const PRIVACY_BOX_NON_GLOW_EMISSIVE_INTENSITY = 0.18;

const BOX_URL = new URL("./assets/boxmain.glb", import.meta.url).href;
const gltfLoader = new GLTFLoader();

/** A camera-anchored safe box ready to receive the future butterfly stream. */
export class PrivacyBoxVisual {

    constructor(camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.name = "Floating privacy safe box";
        this.animationMixer = null;
        this.arrivalAnchor = new THREE.Object3D();
        this.arrivalAnchor.name = "Butterfly arrival anchor";
        this.disposed = false;
        this.loaded = false;
        this.mobileViewport = window.matchMedia("(max-width: 760px)");
        this.visibleHeight = 1;
        this.anchorNdc = new THREE.Vector2();
        this.screenPoint = new THREE.Vector3();
        this.viewDirection = new THREE.Vector3();
        this.hoverOffset = new THREE.Vector3();
    }

    get object3D() {
        return this.group;
    }

    get butterflyArrivalAnchor() {
        return this.arrivalAnchor;
    }

    getButterflyArrivalWorldPosition(target = new THREE.Vector3()) {
        return this.arrivalAnchor.getWorldPosition(target);
    }

    setButterflyProximityGlow() {}

    async initialize() {
        const gltf = await gltfLoader.loadAsync(BOX_URL);

        if (this.disposed) {
            disposeObject3D(gltf.scene);
            return false;
        }

        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);

        if (bounds.isEmpty()) {
            disposeObject3D(model);
            throw new Error("boxmain.glb contains no visible geometry.");
        }

        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());

        model.name = "boxmain.glb authored safe box";
        model.position.copy(center).multiplyScalar(-1);
        model.traverse((child) => {
            if (!child.isMesh) return;

            child.castShadow = false;
            child.receiveShadow = false;
            child.renderOrder = 8;

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

            materials.forEach((material) => {
                if (!material) return;

                if ("emissiveIntensity" in material) {
                    material.emissiveIntensity =
                        PRIVACY_BOX_NON_GLOW_EMISSIVE_INTENSITY;
                }
                material.toneMapped = true;
                material.needsUpdate = true;
            });
        });

        this.visibleHeight = Math.max(size.y, Number.EPSILON);
        this.arrivalAnchor.position.set(0, size.y * 0.04, size.z * 0.58);
        this.group.add(model, this.arrivalAnchor);

        if (gltf.animations.length > 0) {
            this.animationMixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
                this.animationMixer.clipAction(clip).play();
            });
        }

        this.loaded = true;
        this.update(0, 0);

        return true;
    }

    update(deltaTime, elapsedTime) {
        if (this.disposed || !this.loaded) return;

        this.animationMixer?.update(Math.max(0, deltaTime));

        const isMobile = this.mobileViewport.matches;
        const screenHeight = isMobile
            ? PRIVACY_BOX_SCREEN_HEIGHT_MOBILE
            : PRIVACY_BOX_SCREEN_HEIGHT_DESKTOP;
        const visibleCameraHeight = 2 * Math.tan(
            THREE.MathUtils.degToRad(this.camera.fov) * 0.5
        ) * PRIVACY_BOX_CAMERA_DISTANCE;
        const hoverWave = Math.sin(elapsedTime * PRIVACY_BOX_HOVER_SPEED);

        this.anchorNdc.set(
            isMobile
                ? PRIVACY_BOX_SCREEN_X_MOBILE
                : PRIVACY_BOX_SCREEN_X_DESKTOP,
            isMobile
                ? PRIVACY_BOX_SCREEN_Y_MOBILE
                : PRIVACY_BOX_SCREEN_Y_DESKTOP
        );
        this.screenPoint.set(this.anchorNdc.x, this.anchorNdc.y, 0)
            .unproject(this.camera);
        this.viewDirection.subVectors(
            this.screenPoint,
            this.camera.position
        ).normalize();
        this.group.position.copy(this.camera.position).addScaledVector(
            this.viewDirection,
            PRIVACY_BOX_CAMERA_DISTANCE
        );

        this.hoverOffset.set(
            0,
            hoverWave * visibleCameraHeight * PRIVACY_BOX_HOVER_AMPLITUDE,
            0
        ).applyQuaternion(this.camera.quaternion);
        this.group.position.add(this.hoverOffset);

        this.group.quaternion.copy(this.camera.quaternion);

        const scale = visibleCameraHeight * screenHeight / this.visibleHeight;
        this.group.scale.setScalar(scale);
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.animationMixer?.stopAllAction();
        this.animationMixer?.uncacheRoot(this.animationMixer.getRoot());
        this.animationMixer = null;
        this.group.removeFromParent();
        disposeObject3D(this.group);
        this.group.clear();
        this.loaded = false;
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
