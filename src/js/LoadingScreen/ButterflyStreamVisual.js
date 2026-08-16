import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export const BUTTERFLY_FLIGHT_INTERVAL = 5;
export const BUTTERFLY_FIRST_FLIGHT_DELAY = 5;
export const BUTTERFLY_FLIGHT_DURATION = 3.35;
export const BUTTERFLY_ARRIVAL_GLOW_DURATION = 0.6;
export const BUTTERFLY_FLIGHT_SIZE_RATIO = 0.13;
export const BUTTERFLY_TRANSFER_COUNT = 10;
export const BUTTERFLY_TRANSFER_STAGGER = 0.16;
export const BUTTERFLY_WEAVE_HORIZONTAL_RATIO = 0.044;
export const BUTTERFLY_WEAVE_VERTICAL_RATIO = 0.064;
export const BUTTERFLY_WEAVE_HOVER_RATIO = 0.02;
export const BUTTERFLY_AMBIENT_HOVER_RATIO = 0.008;
export const BUTTERFLY_AMBIENT_DRIFT_RATIO = 0.004;
export const BUTTERFLY_MOBILE_LAYOUT_WIDTH = 0.82;
export const BUTTERFLY_ARRIVAL_GLOW_OPACITY = 0.82;
export const TRAIL_PARTICLE_COUNT_DESKTOP = 360;
export const TRAIL_PARTICLE_COUNT_MOBILE = 210;
export const TRAIL_PARTICLES_PER_BUTTERFLY_SECOND = 24;
export const TRAIL_PARTICLE_SIZE_RATIO = 0.034;
export const TRAIL_PARTICLE_OPACITY = 1;
export const TRAIL_PARTICLE_LIFETIME_MIN = 0.78;
export const TRAIL_PARTICLE_LIFETIME_MAX = 1.45;
export const TRAIL_PARTICLE_DRIFT_RATIO = 0.035;
export const TRAIL_PARTICLE_BACKFLOW_RATIO = 0.04;
export const AMBIENT_SPARKLE_COUNT_DESKTOP = 96;
export const AMBIENT_SPARKLE_COUNT_MOBILE = 58;
export const AMBIENT_SPARKLE_SIZE_RATIO = 0.018;

const ASSET_URLS = [
    new URL("./assets/pinkbtf.glb", import.meta.url).href,
    new URL("./assets/purplebtf.glb", import.meta.url).href
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
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.03,
        x: -0.31,
        y: 0.38,
        z: 0.74,
        phase: 5.4,
        speed: 0.88,
        clip: "butterflap"
    },
    {
        sourceIndex: 0,
        sizeRatio: 0.041,
        x: 0.33,
        y: 0.34,
        z: 0.8,
        phase: 2.35,
        speed: 1.02,
        clip: "butterflap"
    },
    {
        sourceIndex: 0,
        sizeRatio: 0.028,
        x: -0.46,
        y: 0.17,
        z: 0.7,
        phase: 3.85,
        speed: 0.91,
        clip: "butterflap"
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.036,
        x: 0.46,
        y: 0.07,
        z: 0.83,
        phase: 0.95,
        speed: 1.12,
        clip: "butterflap"
    },
    {
        sourceIndex: 1,
        sizeRatio: 0.043,
        x: -0.36,
        y: -0.11,
        z: 0.79,
        phase: 4.95,
        speed: 0.8,
        clip: "butterflap"
    },
    {
        sourceIndex: 0,
        sizeRatio: 0.032,
        x: 0.31,
        y: -0.27,
        z: 0.73,
        phase: 1.25,
        speed: 0.97,
        clip: "butterflap"
    }
];
const TRANSFER_SIZE_FACTORS = [1, 0.86, 0.78, 0.92, 0.72, 0.82, 0.68, 0.88, 0.75, 0.95];
const TRAIL_PALETTE = [
    new THREE.Color(0xffd5f5),
    new THREE.Color(0xd59cff),
    new THREE.Color(0xffffff),
    new THREE.Color(0xb56dff)
];

const gltfLoader = new GLTFLoader();

/** Ten ambient butterflies plus a staggered ten-butterfly transfer loop. */
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
        this.particleTrail = null;
        this.ambientSparkles = null;
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

        this.ambientSparkles = createAmbientSparkles(this.hostSize);
        hostLayer.add(this.ambientSparkles.points);

        this.arrivalGlowTexture = createArrivalGlowTexture();
        const hostWorldHeight = this.hostSize.y *
            this.hostVisual.object3D.scale.y;

        for (let index = 0; index < BUTTERFLY_TRANSFER_COUNT; index += 1) {
            const source = this.sources[index % this.sources.length];
            const butterfly = createButterfly(
                source,
                ["butterflap", "buttersoar", "butteridle"],
                `${source.label} transfer butterfly ${index + 1}`
            );

            butterfly.baseScale = hostWorldHeight *
                BUTTERFLY_FLIGHT_SIZE_RATIO *
                TRANSFER_SIZE_FACTORS[index] / source.span;
            butterfly.wrapper.visible = false;
            butterfly.mixer.timeScale = 1.08 + (index % 3) * 0.07;
            butterfly.pathPosition = new THREE.Vector3();
            butterfly.nextPathPosition = new THREE.Vector3();
            butterfly.pathTangent = new THREE.Vector3();
            butterfly.pathPhase = index / BUTTERFLY_TRANSFER_COUNT *
                Math.PI * 2;
            butterfly.startDelay = index * BUTTERFLY_TRANSFER_STAGGER;
            butterfly.glow = createArrivalGlow(
                this.arrivalGlowTexture,
                index % this.sources.length === 0 ? 0xff9de8 : 0xba8cff
            );
            this.group.add(butterfly.wrapper, butterfly.glow);
            this.flightButterflies[index] = butterfly;
        }

        this.particleTrail = createParticleTrail(hostWorldHeight);
        this.group.add(this.particleTrail.points);

        this.initialized = true;
        return true;
    }

    update(deltaTime, elapsedTime) {
        if (this.disposed || !this.initialized) return;

        this.updateAmbientButterflies(deltaTime, elapsedTime);
        updateAmbientSparkles(this.ambientSparkles, elapsedTime);
        updateParticleTrail(this.particleTrail, deltaTime);
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
            this.privacyBoxVisual.setTransferCycleTime(0);
            this.privacyBoxVisual.setButterflyProximityGlow(0);
            this.hideFlightButterflies();
            return;
        }

        const repeatingTime = timeline - BUTTERFLY_FIRST_FLIGHT_DELAY;
        const cycle = Math.floor(repeatingTime / BUTTERFLY_FLIGHT_INTERVAL);
        const cycleTime = repeatingTime - cycle * BUTTERFLY_FLIGHT_INTERVAL;

        this.privacyBoxVisual.setTransferCycleTime(cycleTime);

        if (cycle !== this.lastFlightCycle) this.beginFlight(cycle);

        if (cycleTime > BUTTERFLY_FLIGHT_DURATION +
            BUTTERFLY_ARRIVAL_GLOW_DURATION) {
            this.privacyBoxVisual.setButterflyProximityGlow(0);
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

            this.privacyBoxVisual.setButterflyProximityGlow(1 - glowProgress);

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

        let closestProximity = 0;

        this.flightButterflies.forEach((butterfly, index) => {
            const activeDuration = BUTTERFLY_FLIGHT_DURATION -
                butterfly.startDelay;
            const progress = THREE.MathUtils.clamp(
                (cycleTime - butterfly.startDelay) / activeDuration,
                0,
                1
            );
            const launched = cycleTime >= butterfly.startDelay;

            butterfly.wrapper.visible = launched;
            butterfly.glow.visible = false;
            if (!launched) return;

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
                elapsedTime + 0.012 * activeDuration,
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
            const distanceToBox = butterfly.pathPosition.distanceTo(
                this.targetPosition
            );
            const proximity = 1 - THREE.MathUtils.smoothstep(
                distanceToBox,
                hostWorldHeight * 0.025,
                hostWorldHeight * 0.42
            );

            closestProximity = Math.max(closestProximity, proximity);

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

        emitParticleTrail(
            this.particleTrail,
            this.flightButterflies,
            deltaTime,
            hostWorldHeight,
            this.cameraRight,
            this.cameraUp
        );

        this.privacyBoxVisual.setButterflyProximityGlow(closestProximity);
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
        const phase = this.flightButterflies[index]?.pathPhase || 0;
        const switchingWave = Math.sin(
            progress * Math.PI * 3 + phase
        ) * pathEnvelope;
        const hoverWave = Math.sin(
            elapsedTime * 5.2 + progress * 8 + phase * 1.31
        ) * pathEnvelope;

        target.addScaledVector(
            this.cameraRight,
            switchingWave * hostHeight *
                BUTTERFLY_WEAVE_HORIZONTAL_RATIO
        );
        target.addScaledVector(
            this.cameraUp,
            switchingWave * hostHeight * BUTTERFLY_WEAVE_VERTICAL_RATIO +
                hoverWave * hostHeight * BUTTERFLY_WEAVE_HOVER_RATIO
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
        disposeAmbientSparkles(this.ambientSparkles);
        disposeParticleTrail(this.particleTrail);
        this.sources.forEach((source) => disposeObject3D(source.scene));
        this.group.removeFromParent();
        this.group.clear();
        this.sources.length = 0;
        this.ambientButterflies.length = 0;
        this.flightButterflies.length = 0;
        this.arrivalGlowTexture = null;
        this.ambientSparkles = null;
        this.particleTrail = null;
        this.privacyBoxVisual.setButterflyProximityGlow(0);
        this.initialized = false;
    }
}

function createAmbientSparkles(hostSize) {
    const count = window.matchMedia("(max-width: 760px)").matches
        ? AMBIENT_SPARKLE_COUNT_MOBILE
        : AMBIENT_SPARKLE_COUNT_DESKTOP;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let randomState = 0x5ab47d31;

    const random = () => {
        randomState ^= randomState << 13;
        randomState ^= randomState >>> 17;
        randomState ^= randomState << 5;
        randomState >>>= 0;
        return randomState / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        const side = random() < 0.5 ? -1 : 1;
        const radius = THREE.MathUtils.lerp(0.16, 0.58, random());
        const color = TRAIL_PALETTE[index % TRAIL_PALETTE.length];

        positions[offset] = hostSize.x * radius * side;
        positions[offset + 1] = hostSize.y *
            THREE.MathUtils.lerp(-0.38, 0.46, random());
        positions[offset + 2] = hostSize.z *
            THREE.MathUtils.lerp(0.64, 0.88, random());
        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        map: createParticleTexture(),
        size: hostSize.y * AMBIENT_SPARKLE_SIZE_RATIO,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.62,
        vertexColors: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    const points = new THREE.Points(geometry, material);

    points.name = "Ambient privacy sparkles";
    points.renderOrder = 8;
    points.frustumCulled = false;

    return { points, material };
}

function updateAmbientSparkles(sparkles, elapsedTime) {
    if (!sparkles) return;

    sparkles.material.opacity = 0.5 +
        Math.sin(elapsedTime * 1.7) * 0.12;
    sparkles.points.rotation.z = Math.sin(elapsedTime * 0.16) * 0.012;
}

function disposeAmbientSparkles(sparkles) {
    if (!sparkles) return;

    sparkles.points.removeFromParent();
    sparkles.points.geometry.dispose();
    sparkles.material.map?.dispose();
    sparkles.material.dispose();
}

function createParticleTrail(hostWorldHeight) {
    const count = window.matchMedia("(max-width: 760px)").matches
        ? TRAIL_PARTICLE_COUNT_MOBILE
        : TRAIL_PARTICLE_COUNT_DESKTOP;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseColors = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const lifetimes = new Float32Array(count);

    ages.fill(Number.POSITIVE_INFINITY);
    for (let index = 0; index < count; index += 1) {
        positions[index * 3 + 1] = -1000;
    }

    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    const colorAttribute = new THREE.BufferAttribute(colors, 3);

    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    colorAttribute.setUsage(THREE.DynamicDrawUsage);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("color", colorAttribute);

    const material = new THREE.PointsMaterial({
        map: createParticleTexture(),
        size: hostWorldHeight * TRAIL_PARTICLE_SIZE_RATIO,
        sizeAttenuation: true,
        transparent: true,
        opacity: TRAIL_PARTICLE_OPACITY,
        vertexColors: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    const points = new THREE.Points(geometry, material);

    points.name = "Six-butterfly particle trail";
    points.frustumCulled = false;
    points.renderOrder = 8;

    return {
        points,
        positions,
        velocities,
        colors,
        baseColors,
        ages,
        lifetimes,
        hostWorldHeight,
        cursor: 0,
        butterflyCursor: 0,
        emissionCarry: 0,
        randomState: 0x51f15e3d
    };
}

function updateParticleTrail(trail, deltaTime) {
    if (!trail) return;

    const timeStep = Math.min(Math.max(deltaTime, 0), 1 / 30);
    const drift = trail.hostWorldHeight * TRAIL_PARTICLE_DRIFT_RATIO;

    for (let index = 0; index < trail.ages.length; index += 1) {
        if (trail.ages[index] >= trail.lifetimes[index]) continue;

        const offset = index * 3;

        trail.ages[index] += timeStep;

        if (trail.ages[index] >= trail.lifetimes[index]) {
            trail.ages[index] = Number.POSITIVE_INFINITY;
            trail.positions[offset] = 0;
            trail.positions[offset + 1] = -1000;
            trail.positions[offset + 2] = 0;
            trail.colors[offset] = 0;
            trail.colors[offset + 1] = 0;
            trail.colors[offset + 2] = 0;
            continue;
        }

        trail.velocities[offset] +=
            (nextTrailRandom(trail) * 2 - 1) * drift * timeStep;
        trail.velocities[offset + 1] +=
            (nextTrailRandom(trail) * 2 - 1) * drift * timeStep;
        trail.velocities[offset + 2] +=
            (nextTrailRandom(trail) * 2 - 1) * drift * 0.35 * timeStep;

        trail.positions[offset] += trail.velocities[offset] * timeStep;
        trail.positions[offset + 1] += trail.velocities[offset + 1] * timeStep;
        trail.positions[offset + 2] += trail.velocities[offset + 2] * timeStep;

        const remaining = 1 - trail.ages[index] / trail.lifetimes[index];

        if (remaining <= 0.12) {
            trail.ages[index] = Number.POSITIVE_INFINITY;
            trail.positions[offset] = 0;
            trail.positions[offset + 1] = -1000;
            trail.positions[offset + 2] = 0;
            trail.colors[offset] = 0;
            trail.colors[offset + 1] = 0;
            trail.colors[offset + 2] = 0;
            continue;
        }

        const fade = remaining;

        trail.colors[offset] = trail.baseColors[offset] * fade;
        trail.colors[offset + 1] = trail.baseColors[offset + 1] * fade;
        trail.colors[offset + 2] = trail.baseColors[offset + 2] * fade;
    }

    trail.points.geometry.attributes.position.needsUpdate = true;
    trail.points.geometry.attributes.color.needsUpdate = true;
}

function emitParticleTrail(
    trail,
    butterflies,
    deltaTime,
    hostWorldHeight,
    cameraRight,
    cameraUp
) {
    if (!trail || butterflies.length === 0) return;

    trail.emissionCarry += deltaTime *
        TRAIL_PARTICLES_PER_BUTTERFLY_SECOND * butterflies.length;

    while (trail.emissionCarry >= 1) {
        const butterfly = butterflies[
            trail.butterflyCursor % butterflies.length
        ];

        trail.butterflyCursor += 1;
        trail.emissionCarry -= 1;

        if (!butterfly.wrapper.visible) continue;

        const particleIndex = trail.cursor;
        const offset = particleIndex * 3;
        const spread = hostWorldHeight * 0.012;
        const sideJitter = (nextTrailRandom(trail) * 2 - 1) * spread;
        const heightJitter = (nextTrailRandom(trail) * 2 - 1) * spread;
        const depthJitter = (nextTrailRandom(trail) * 2 - 1) * spread * 0.35;
        const backflow = hostWorldHeight * TRAIL_PARTICLE_BACKFLOW_RATIO *
            THREE.MathUtils.lerp(0.55, 1.05, nextTrailRandom(trail));
        const color = TRAIL_PALETTE[
            particleIndex % TRAIL_PALETTE.length
        ];

        trail.positions[offset] = butterfly.pathPosition.x +
            cameraRight.x * sideJitter + cameraUp.x * heightJitter;
        trail.positions[offset + 1] = butterfly.pathPosition.y +
            cameraRight.y * sideJitter + cameraUp.y * heightJitter;
        trail.positions[offset + 2] = butterfly.pathPosition.z +
            cameraRight.z * sideJitter + cameraUp.z * heightJitter +
            depthJitter;

        trail.velocities[offset] = -butterfly.pathTangent.x * backflow +
            cameraRight.x * sideJitter * 0.7;
        trail.velocities[offset + 1] = -butterfly.pathTangent.y * backflow +
            cameraUp.y * heightJitter * 0.7;
        trail.velocities[offset + 2] = -butterfly.pathTangent.z * backflow +
            depthJitter * 0.7;

        trail.baseColors[offset] = color.r;
        trail.baseColors[offset + 1] = color.g;
        trail.baseColors[offset + 2] = color.b;
        trail.colors[offset] = color.r;
        trail.colors[offset + 1] = color.g;
        trail.colors[offset + 2] = color.b;
        trail.ages[particleIndex] = 0;
        trail.lifetimes[particleIndex] = THREE.MathUtils.lerp(
            TRAIL_PARTICLE_LIFETIME_MIN,
            TRAIL_PARTICLE_LIFETIME_MAX,
            nextTrailRandom(trail)
        );
        trail.cursor = (particleIndex + 1) % trail.ages.length;
    }

    trail.points.geometry.attributes.position.needsUpdate = true;
    trail.points.geometry.attributes.color.needsUpdate = true;
}

function nextTrailRandom(trail) {
    let state = trail.randomState;

    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    trail.randomState = state >>> 0;
    return trail.randomState / 4294967296;
}

function disposeParticleTrail(trail) {
    if (!trail) return;

    trail.points.removeFromParent();
    trail.points.geometry.dispose();
    trail.points.material.map?.dispose();
    trail.points.material.dispose();
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

function createParticleTexture() {
    const canvas = document.createElement("canvas");
    const size = 64;
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
    gradient.addColorStop(0.24, "rgba(255, 232, 255, 0.92)");
    gradient.addColorStop(0.62, "rgba(203, 115, 255, 0.32)");
    gradient.addColorStop(1, "rgba(148, 62, 218, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
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
