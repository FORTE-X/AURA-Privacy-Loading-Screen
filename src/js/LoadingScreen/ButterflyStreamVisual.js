import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export const BUTTERFLY_FLIGHT_INTERVAL = 5;
export const BUTTERFLY_FIRST_FLIGHT_DELAY = 5;
export const BUTTERFLY_FLIGHT_DURATION = 3.35;
export const BUTTERFLY_ARRIVAL_GLOW_DURATION = 0.6;
export const BUTTERFLY_FLIGHT_SIZE_RATIO = 0.095;
export const BUTTERFLY_AMBIENT_HOVER_RATIO = 0.008;
export const BUTTERFLY_AMBIENT_DRIFT_RATIO = 0.004;
export const BUTTERFLY_MOBILE_LAYOUT_WIDTH = 0.82;
export const BUTTERFLY_ARRIVAL_GLOW_OPACITY = 0.68;

const ASSET_URLS = [
    "./js/LoadingScreen/assets/pinkbtf.glb",
    "./js/LoadingScreen/assets/purplebtf.glb"
];
const AMBIENT_LAYOUT = [
    {
        sourceIndex: 0,
        sizeRatio: 0.034,
        x: -0.4,
        y: 0.29,
        z: 0.72,
        phase: 0.25,
        speed: 0.82,
        clip: "butterflap"
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.046,
        x: 0.42,
        y: 0.2,
        z: 0.78,
        phase: 1.7,
        speed: 0.94,
        clip: "butterflap"
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.039,
        x: -0.43,
        y: 0.04,
        z: 0.82,
        phase: 3.1,
        speed: 0.76,
        clip: "butterflap"
    },
    {
        sourceIndex: 0,
        sizeRatio: 0.052,
        x: 0.4,
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
        this.arrivalGlowTexture = null;
        this.lastFlightCycle = -1;
        this.timelineStart = null;
        this.hostSize = new THREE.Vector3();
        this.launchPosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.controlA = new THREE.Vector3();
        this.controlB = new THREE.Vector3();
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
                [layout.clip, "butterflap", "butteridle"],
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
            const inwardTilt = THREE.MathUtils.degToRad(8 + index * 3);
            butterfly.baseRotationZ = layout.x < 0
                ? Math.PI - inwardTilt
                : inwardTilt;
            butterfly.wrapper.rotation.z = butterfly.baseRotationZ;
            butterfly.phase = layout.phase;
            butterfly.motionSpeed = layout.speed;
            butterfly.layout = layout;
            butterfly.mixer.timeScale = layout.speed;
            hostLayer.add(butterfly.wrapper);
            this.ambientButterflies.push(butterfly);
        });

        this.arrivalGlowTexture = createArrivalGlowTexture();
        this.sources.forEach((source, index) => {
            const butterfly = createButterfly(
                source,
                ["butterflap", "buttersoar", "butteridle"],
                `${source.label} transfer butterfly`
            );
            const hostWorldHeight = this.hostSize.y *
                this.hostVisual.object3D.scale.y;

            butterfly.baseScale = hostWorldHeight *
                BUTTERFLY_FLIGHT_SIZE_RATIO *
                (index === 0 ? 1 : 0.88) / source.span;
            butterfly.wrapper.visible = false;
            butterfly.mixer.timeScale = index === 0 ? 1.22 : 1.12;
            butterfly.pathPosition = new THREE.Vector3();
            butterfly.nextPathPosition = new THREE.Vector3();
            butterfly.pathTangent = new THREE.Vector3();
            butterfly.glow = createArrivalGlow(
                this.arrivalGlowTexture,
                index === 0 ? 0xff9de8 : 0xba8cff
            );
            this.group.add(butterfly.wrapper, butterfly.glow);
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

        if (cycleTime > BUTTERFLY_FLIGHT_DURATION +
            BUTTERFLY_ARRIVAL_GLOW_DURATION) {
            this.hideFlightButterflies();
            return;
        }

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

        if (cycleTime > BUTTERFLY_FLIGHT_DURATION) {
            const glowProgress = (cycleTime - BUTTERFLY_FLIGHT_DURATION) /
                BUTTERFLY_ARRIVAL_GLOW_DURATION;

            this.flightButterflies.forEach((butterfly) => {
                butterfly.wrapper.visible = false;
                butterfly.glow.visible = true;
                butterfly.glow.position.copy(this.targetPosition);
                butterfly.glow.scale.setScalar(
                    hostWorldHeight * THREE.MathUtils.lerp(
                        0.08,
                        0.16,
                        glowProgress
                    )
                );
                butterfly.glow.material.opacity =
                    BUTTERFLY_ARRIVAL_GLOW_OPACITY * (1 - glowProgress);
            });
            return;
        }

        const progress = THREE.MathUtils.clamp(
            cycleTime / BUTTERFLY_FLIGHT_DURATION,
            0,
            1
        );

        this.flightButterflies.forEach((butterfly, index) => {
            butterfly.wrapper.visible = true;
            butterfly.mixer.update(deltaTime);
            this.evaluateFlightPath(
                progress,
                index,
                elapsedTime,
                hostWorldHeight,
                butterfly.pathPosition
            );
            this.evaluateFlightPath(
                Math.min(progress + 0.012, 1),
                index,
                elapsedTime + 0.012 * BUTTERFLY_FLIGHT_DURATION,
                hostWorldHeight,
                butterfly.nextPathPosition
            );
            butterfly.pathTangent.subVectors(
                butterfly.nextPathPosition,
                butterfly.pathPosition
            ).normalize();

            const screenAngle = Math.atan2(
                butterfly.pathTangent.dot(this.cameraUp),
                butterfly.pathTangent.dot(this.cameraRight)
            );
            const emerge = THREE.MathUtils.smoothstep(progress, 0, 0.14);
            const enter = 1 - THREE.MathUtils.smoothstep(progress, 0.82, 1);
            const size = butterfly.baseScale *
                THREE.MathUtils.lerp(0.3, 1, emerge) *
                THREE.MathUtils.lerp(0.08, 1, enter) *
                (1 + Math.sin(elapsedTime * 7 + index) * 0.035);
            const arrivalStrength = THREE.MathUtils.smoothstep(
                progress,
                0.64,
                1
            );

            butterfly.wrapper.position.copy(butterfly.pathPosition);
            butterfly.wrapper.quaternion.copy(this.camera.quaternion);
            butterfly.wrapper.rotateZ(screenAngle - Math.PI);
            butterfly.wrapper.rotateY(
                Math.sin(elapsedTime * 3.2 + index * Math.PI) *
                THREE.MathUtils.degToRad(7)
            );
            butterfly.wrapper.scale.setScalar(size);

            butterfly.glow.visible = arrivalStrength > 0.01;
            butterfly.glow.position.copy(butterfly.pathPosition);
            butterfly.glow.scale.setScalar(
                hostWorldHeight * THREE.MathUtils.lerp(
                    0.035,
                    0.09,
                    arrivalStrength
                )
            );
            butterfly.glow.material.opacity = arrivalStrength *
                BUTTERFLY_ARRIVAL_GLOW_OPACITY;
        });
    }

    evaluateFlightPath(progress, index, elapsedTime, hostHeight, target) {
        cubicBezier(
            this.launchPosition,
            this.controlA,
            this.controlB,
            this.targetPosition,
            easeInOut(progress),
            target
        );

        const pathEnvelope = Math.sin(progress * Math.PI);
        const switchingWave = Math.sin(
            progress * Math.PI * 3 + index * Math.PI
        ) * pathEnvelope;
        const hoverWave = Math.sin(
            elapsedTime * 5.2 + progress * 8 + index * Math.PI
        ) * pathEnvelope;

        target.addScaledVector(
            this.cameraRight,
            switchingWave * hostHeight * 0.022
        );
        target.addScaledVector(
            this.cameraUp,
            switchingWave * hostHeight * 0.032 +
                hoverWave * hostHeight * 0.012
        );
    }

    beginFlight(cycle) {
        this.hideFlightButterflies();
        this.lastFlightCycle = cycle;
        this.flightButterflies.forEach((butterfly) => {
            butterfly.wrapper.visible = true;
            butterfly.action.reset().play();
        });
    }

    hideFlightButterflies() {
        this.flightButterflies.forEach((butterfly) => {
            butterfly.wrapper.visible = false;
            butterfly.glow.visible = false;
            butterfly.glow.material.opacity = 0;
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
                if (butterfly.glow) {
                    butterfly.glow.removeFromParent();
                    butterfly.glow.material.dispose();
                }
            }
        );
        this.arrivalGlowTexture?.dispose();
        this.sources.forEach((source) => disposeObject3D(source.scene));
        this.group.removeFromParent();
        this.group.clear();
        this.sources.length = 0;
        this.ambientButterflies.length = 0;
        this.flightButterflies.length = 0;
        this.arrivalGlowTexture = null;
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

function createArrivalGlowTexture() {
    const canvas = document.createElement("canvas");
    const size = 128;
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

    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, "rgba(255, 246, 255, 0.88)");
    gradient.addColorStop(0.58, "rgba(226, 151, 255, 0.32)");
    gradient.addColorStop(1, "rgba(173, 72, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function createArrivalGlow(texture, color) {
    const material = new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    const glow = new THREE.Sprite(material);

    glow.name = "Butterfly privacy-box arrival glow";
    glow.visible = false;
    glow.renderOrder = 10;
    return glow;
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
