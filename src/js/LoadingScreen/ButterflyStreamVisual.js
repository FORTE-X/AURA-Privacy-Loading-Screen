import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export const BUTTERFLY_FLIGHT_INTERVAL = 5;
export const BUTTERFLY_FIRST_FLIGHT_DELAY = 5;
export const BUTTERFLY_FLIGHT_DURATION = 3.35;
export const BUTTERFLY_FLIGHT_SIZE_RATIO = 0.095;
export const BUTTERFLY_AMBIENT_HOVER_RATIO = 0.008;
export const BUTTERFLY_AMBIENT_DRIFT_RATIO = 0.004;
export const BUTTERFLY_MOBILE_LAYOUT_WIDTH = 0.56;

const ASSET_URLS = [
    "./js/LoadingScreen/assets/pinkbtf.glb",
    "./js/LoadingScreen/assets/purplebtf.glb"
];
const AMBIENT_LAYOUT = [
    {
        sourceIndex: 0,
        sizeRatio: 0.034,
        x: -0.58,
        y: 0.29,
        z: 0.72,
        phase: 0.25,
        speed: 0.82,
        clip: "butteridle"
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.046,
        x: 0.6,
        y: 0.2,
        z: 0.78,
        phase: 1.7,
        speed: 0.94,
        clip: "butterflap"
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.039,
        x: -0.6,
        y: 0.04,
        z: 0.82,
        phase: 3.1,
        speed: 0.76,
        clip: "butteridle"
    },
    {
        sourceIndex: 0,
        sizeRatio: 0.052,
        x: 0.57,
        y: -0.13,
        z: 0.76,
        phase: 4.5,
        speed: 1.08,
        clip: "butterflap"
    }
];

const gltfLoader = new GLTFLoader();

/** Four ambient butterflies plus a five-second privacy-box transfer loop. */
export class ButterflyStreamVisual {

    constructor(camera, hostVisual, privacyBoxVisual) {
        this.camera = camera;
        this.hostVisual = hostVisual;
        this.privacyBoxVisual = privacyBoxVisual;
        this.group = new THREE.Group();
        this.group.name = "Butterflies flying to privacy safe box";
        this.sources = [];
        this.ambientButterflies = [];
        this.flightButterflies = [];
        this.activeFlight = null;
        this.lastFlightCycle = -1;
        this.timelineStart = null;
        this.hostSize = new THREE.Vector3();
        this.launchPosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.controlA = new THREE.Vector3();
        this.controlB = new THREE.Vector3();
        this.pathPosition = new THREE.Vector3();
        this.nextPathPosition = new THREE.Vector3();
        this.pathTangent = new THREE.Vector3();
        this.cameraRight = new THREE.Vector3();
        this.cameraUp = new THREE.Vector3();
        this.towardCamera = new THREE.Vector3();
        this.mobileViewport = window.matchMedia("(max-width: 760px)");
        this.disposed = false;
        this.initialized = false;
    }

    get object3D() {
        return this.group;
    }

    async initialize() {
        const results = await Promise.allSettled(
            ASSET_URLS.map((url) => gltfLoader.loadAsync(url))
        );
        const failed = results.find((result) => result.status === "rejected");

        if (failed || this.disposed) {
            results.forEach((result) => {
                if (result.status === "fulfilled") {
                    disposeObject3D(result.value.scene);
                }
            });

            if (failed) throw failed.reason;
            return false;
        }

        this.sources = results.map((result, index) => prepareSource(
            result.value,
            index === 0 ? "Pink" : "Purple"
        ));
        this.hostVisual.getButterflyLayoutSize(this.hostSize);

        if (this.hostSize.lengthSq() === 0) {
            this.sources.forEach((source) => disposeObject3D(source.scene));
            this.sources.length = 0;
            throw new Error("The loading model is not ready for butterflies.");
        }

        const hostLayer = this.hostVisual.getButterflyLayer();

        AMBIENT_LAYOUT.forEach((layout, index) => {
            const source = this.sources[layout.sourceIndex];
            const butterfly = createButterfly(
                source,
                [layout.clip, "butteridle", "butterflap"],
                `Small surrounding butterfly ${index + 1}`
            );
            const scale = this.hostSize.y * layout.sizeRatio / source.span;

            butterfly.wrapper.position.set(
                this.hostSize.x * layout.x,
                this.hostSize.y * layout.y,
                this.hostSize.z * layout.z
            );
            butterfly.wrapper.scale.setScalar(scale);
            butterfly.basePosition = butterfly.wrapper.position.clone();
            butterfly.baseRotationZ = (index % 2 === 0 ? -1 : 1) *
                THREE.MathUtils.degToRad(8 + index * 3);
            butterfly.wrapper.rotation.z = butterfly.baseRotationZ;
            butterfly.phase = layout.phase;
            butterfly.motionSpeed = layout.speed;
            butterfly.layout = layout;
            butterfly.mixer.timeScale = layout.speed;
            hostLayer.add(butterfly.wrapper);
            this.ambientButterflies.push(butterfly);
        });

        this.sources.forEach((source, index) => {
            const butterfly = createButterfly(
                source,
                ["buttersoar", "butterflap", "butteridle"],
                `${source.label} transfer butterfly`
            );
            const hostWorldHeight = this.hostSize.y *
                this.hostVisual.object3D.scale.y;

            butterfly.baseScale = hostWorldHeight *
                BUTTERFLY_FLIGHT_SIZE_RATIO / source.span;
            butterfly.wrapper.visible = false;
            butterfly.mixer.timeScale = 1.16;
            this.group.add(butterfly.wrapper);
            this.flightButterflies[index] = butterfly;
        });

        this.initialized = true;
        return true;
    }

    update(deltaTime, elapsedTime) {
        if (this.disposed || !this.initialized) return;

        this.updateAmbientButterflies(deltaTime, elapsedTime);
        this.updateTransferButterfly(deltaTime, elapsedTime);
    }

    updateAmbientButterflies(deltaTime, elapsedTime) {
        const hover = this.hostSize.y * BUTTERFLY_AMBIENT_HOVER_RATIO;
        const drift = this.hostSize.x * BUTTERFLY_AMBIENT_DRIFT_RATIO;
        const layoutWidth = this.mobileViewport.matches
            ? BUTTERFLY_MOBILE_LAYOUT_WIDTH
            : 1;

        this.ambientButterflies.forEach((butterfly) => {
            const wave = Math.sin(
                elapsedTime * butterfly.motionSpeed + butterfly.phase
            );
            const crossWave = Math.cos(
                elapsedTime * butterfly.motionSpeed * 0.71 + butterfly.phase
            );

            butterfly.mixer.update(deltaTime);
            butterfly.basePosition.set(
                this.hostSize.x * butterfly.layout.x * layoutWidth,
                this.hostSize.y * butterfly.layout.y,
                this.hostSize.z * butterfly.layout.z
            );
            butterfly.wrapper.position.set(
                butterfly.basePosition.x + crossWave * drift,
                butterfly.basePosition.y + wave * hover,
                butterfly.basePosition.z
            );
            butterfly.wrapper.rotation.z = butterfly.baseRotationZ +
                crossWave * THREE.MathUtils.degToRad(5);
        });
    }

    updateTransferButterfly(deltaTime, elapsedTime) {
        if (this.timelineStart === null) this.timelineStart = elapsedTime;

        const timeline = elapsedTime - this.timelineStart;

        if (timeline < BUTTERFLY_FIRST_FLIGHT_DELAY) {
            this.hideFlightButterflies();
            return;
        }

        const repeatingTime = timeline - BUTTERFLY_FIRST_FLIGHT_DELAY;
        const cycle = Math.floor(repeatingTime / BUTTERFLY_FLIGHT_INTERVAL);
        const cycleTime = repeatingTime - cycle * BUTTERFLY_FLIGHT_INTERVAL;

        if (cycle !== this.lastFlightCycle) this.beginFlight(cycle);

        if (!this.activeFlight || cycleTime > BUTTERFLY_FLIGHT_DURATION) {
            if (this.activeFlight) this.activeFlight.wrapper.visible = false;
            return;
        }

        this.activeFlight.wrapper.visible = true;
        this.activeFlight.mixer.update(deltaTime);

        const progress = THREE.MathUtils.clamp(
            cycleTime / BUTTERFLY_FLIGHT_DURATION,
            0,
            1
        );

        this.hostVisual.getButterflyLaunchWorldPosition(this.launchPosition);
        this.privacyBoxVisual.getButterflyArrivalWorldPosition(
            this.targetPosition
        );
        this.cameraRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
        this.cameraUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
        this.towardCamera.subVectors(
            this.camera.position,
            this.launchPosition
        ).normalize();

        const hostWorldHeight = this.hostSize.y *
            this.hostVisual.object3D.scale.y;

        this.controlA.copy(this.launchPosition)
            .addScaledVector(this.cameraRight, hostWorldHeight * 0.16)
            .addScaledVector(this.cameraUp, hostWorldHeight * 0.07)
            .addScaledVector(this.towardCamera, hostWorldHeight * 0.12);
        this.controlB.copy(this.targetPosition)
            .addScaledVector(this.cameraRight, -hostWorldHeight * 0.1)
            .addScaledVector(this.cameraUp, -hostWorldHeight * 0.07);

        cubicBezier(
            this.launchPosition,
            this.controlA,
            this.controlB,
            this.targetPosition,
            easeInOut(progress),
            this.pathPosition
        );
        cubicBezier(
            this.launchPosition,
            this.controlA,
            this.controlB,
            this.targetPosition,
            Math.min(easeInOut(progress) + 0.012, 1),
            this.nextPathPosition
        );
        this.pathTangent.subVectors(
            this.nextPathPosition,
            this.pathPosition
        ).normalize();

        const screenAngle = Math.atan2(
            this.pathTangent.dot(this.cameraUp),
            this.pathTangent.dot(this.cameraRight)
        );
        const emerge = THREE.MathUtils.smoothstep(progress, 0, 0.14);
        const enter = 1 - THREE.MathUtils.smoothstep(progress, 0.82, 1);
        const size = this.activeFlight.baseScale *
            THREE.MathUtils.lerp(0.3, 1, emerge) *
            THREE.MathUtils.lerp(0.08, 1, enter) *
            (1 + Math.sin(elapsedTime * 7) * 0.035);

        this.activeFlight.wrapper.position.copy(this.pathPosition);
        this.activeFlight.wrapper.quaternion.copy(this.camera.quaternion);
        this.activeFlight.wrapper.rotateZ(screenAngle - Math.PI * 0.5);
        this.activeFlight.wrapper.rotateY(
            Math.sin(elapsedTime * 3.2) * THREE.MathUtils.degToRad(7)
        );
        this.activeFlight.wrapper.scale.setScalar(size);
    }

    beginFlight(cycle) {
        this.hideFlightButterflies();
        this.lastFlightCycle = cycle;
        this.activeFlight = this.flightButterflies[cycle %
            this.flightButterflies.length];
        this.activeFlight.wrapper.visible = true;
        this.activeFlight.action.reset().play();
    }

    hideFlightButterflies() {
        this.flightButterflies.forEach((butterfly) => {
            butterfly.wrapper.visible = false;
        });
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        [...this.ambientButterflies, ...this.flightButterflies].forEach(
            (butterfly) => {
                butterfly.action.stop();
                butterfly.mixer.stopAllAction();
                butterfly.wrapper.removeFromParent();
                butterfly.wrapper.clear();
            }
        );
        this.sources.forEach((source) => disposeObject3D(source.scene));
        this.group.removeFromParent();
        this.group.clear();
        this.sources.length = 0;
        this.ambientButterflies.length = 0;
        this.flightButterflies.length = 0;
        this.activeFlight = null;
        this.initialized = false;
    }
}

function prepareSource(gltf, label) {
    const bounds = new THREE.Box3().setFromObject(gltf.scene);

    if (bounds.isEmpty()) {
        disposeObject3D(gltf.scene);
        throw new Error(`${label} butterfly contains no visible geometry.`);
    }

    const size = bounds.getSize(new THREE.Vector3());

    return {
        label,
        scene: gltf.scene,
        animations: gltf.animations,
        center: bounds.getCenter(new THREE.Vector3()),
        span: Math.max(size.x, size.y, size.z, Number.EPSILON)
    };
}

function createButterfly(source, preferredClips, name) {
    const model = cloneSkeleton(source.scene);
    const wrapper = new THREE.Group();
    const clip = preferredClips
        .map((clipName) => THREE.AnimationClip.findByName(
            source.animations,
            clipName
        ))
        .find(Boolean) || source.animations[0];

    if (!clip) {
        throw new Error(`${source.label} butterfly has no animation clips.`);
    }

    model.position.copy(source.center).multiplyScalar(-1);
    model.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = false;
        child.renderOrder = 9;
    });

    wrapper.name = name;
    wrapper.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.play();

    return { wrapper, model, mixer, action };
}

function cubicBezier(point0, point1, point2, point3, t, target) {
    const inverse = 1 - t;
    const inverseSquared = inverse * inverse;
    const tSquared = t * t;

    return target.set(0, 0, 0)
        .addScaledVector(point0, inverseSquared * inverse)
        .addScaledVector(point1, 3 * inverseSquared * t)
        .addScaledVector(point2, 3 * inverse * tSquared)
        .addScaledVector(point3, tSquared * t);
}

function easeInOut(value) {
    return value * value * (3 - 2 * value);
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
