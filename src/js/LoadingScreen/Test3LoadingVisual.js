import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODEL_VIEW_HEIGHT_RATIO = 0.68;
export const MODEL_VERTICAL_POSITION = 0.75;
export const MODEL_FLOAT_AMPLITUDE = 0.045;
export const MODEL_FLOAT_SPEED = 0.55;
export const MODEL_TURN_AMPLITUDE = 0.045;
export const MODEL_TURN_SPEED = 0.32;

export const FLOWER_HOVER_AMPLITUDE = 0.009;
export const FLOWER_HOVER_SPEED_MIN = 0.72;
export const FLOWER_HOVER_SPEED_MAX = 1.08;
export const FLOWER_SWAY_AMPLITUDE = 0.018;
export const FLOWER_COLOR_BREATH_STRENGTH = 0.18;
export const FLOWER_BASE_EMISSIVE_INTENSITY = 1.15;
export const FLOWER_BLOOM_MIN = 0.84;
export const FLOWER_BLOOM_MAX = 1.08;

export const PARTICLE_COUNT_DESKTOP = 92;
export const PARTICLE_COUNT_MOBILE = 56;
export const PARTICLE_SPREAD_X = 0.95;
export const PARTICLE_SPREAD_Y = 0.38;
export const PARTICLE_SPREAD_Z = 0.42;
export const PARTICLE_SIZE = 0.022;
export const PARTICLE_OPACITY = 0.84;
export const PARTICLE_BROWNIAN_FORCE = 0.066;
export const PARTICLE_CENTERING_FORCE = 0.28;
export const PARTICLE_DRAG = 1.9;

export const BOTTOM_GLOW_DIM_INTERVAL = 2;
export const BOTTOM_GLOW_DIM_DURATION = 0.42;
export const BOTTOM_GLOW_DIM_STRENGTH = 0.5;
export const BOTTOM_LIGHT_MAX_INTENSITY = 2.7;
export const BOTTOM_LIGHT_DISTANCE = 2.2;
export const BOTTOM_GLOW_MAX_OPACITY = 0.39;

const gltfLoader = new GLTFLoader();
const MODEL_URL = "./js/LoadingScreen/assets/test3main2.glb";
const FLOWER_TINTS = [
    new THREE.Color(0xffd2f4),
    new THREE.Color(0xd8adff),
    new THREE.Color(0xffaee9),
    new THREE.Color(0xf0d7ff)
];

/** Preserves the authored GLB while animating its separate flower objects. */
export class Test3LoadingVisual {

    constructor(camera) {
        this.camera = camera;
        this.group = new THREE.Group();
        this.group.name = "Test3 Authored Loading Visual";
        this.flowerAnimations = [];
        this.particleField = null;
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
        const mainObject = model.children.find((child) =>
            child.name.toLowerCase() === "main"
        );
        const flowerObjects = model.children.filter((child) =>
            child !== mainObject && containsMesh(child)
        );

        if (!mainObject) {
            disposeObject3D(model);
            throw new Error("test3main2.glb is missing its main model object.");
        }

        if (flowerObjects.length === 0) {
            disposeObject3D(model);
            throw new Error("test3main2.glb contains no separate flower objects.");
        }

        model.traverse((child) => {
            if (!child.isMesh) return;

            child.castShadow = false;
            child.receiveShadow = false;

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

            materials.forEach((material) => {
                if (material) material.needsUpdate = true;
            });
        });

        const sourceFlowerMaterials = new Set();
        flowerObjects.forEach((flower, index) => {
            this.flowerAnimations.push(prepareFlower(
                flower,
                index,
                sourceFlowerMaterials
            ));
        });
        sourceFlowerMaterials.forEach((material) => material.dispose());

        const bounds = new THREE.Box3().setFromObject(model);

        if (bounds.isEmpty()) {
            disposeObject3D(model);
            throw new Error("test3main2.glb contains no visible geometry.");
        }

        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const cameraDistance = Math.abs(this.camera.position.z);
        const visibleHeight = 2 * Math.tan(
            THREE.MathUtils.degToRad(this.camera.fov) * 0.5
        ) * cameraDistance;
        const scale = visibleHeight * MODEL_VIEW_HEIGHT_RATIO /
            Math.max(size.y, Number.EPSILON);

        model.name = "test3main2.glb Textured Model and Flowers";
        model.position.copy(center).multiplyScalar(-1);

        this.particleField = createParticleField(size);

        this.bottomLight = new THREE.PointLight(
            0xef82ff,
            BOTTOM_LIGHT_MAX_INTENSITY,
            BOTTOM_LIGHT_DISTANCE,
            2
        );
        this.bottomLight.name = "Bright lower pulsing light";
        this.bottomLight.position.set(0, -size.y * 0.5, size.z * 0.58);

        this.bottomGlow = createBottomGlow();
        this.bottomGlow.position.set(0, -size.y * 0.55, size.z * 0.48);
        this.bottomGlow.scale.set(size.x * 1.14, size.y * 0.25, 1);

        this.group.scale.setScalar(scale);
        this.group.position.y = MODEL_VERTICAL_POSITION;
        this.group.add(
            model,
            this.particleField.points,
            this.bottomLight,
            this.bottomGlow
        );

        return true;
    }

    update(deltaTime, elapsedTime) {
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

        updateParticleField(this.particleField, deltaTime);

        this.flowerAnimations.forEach((flower) => {
            const hoverWave = Math.sin(
                elapsedTime * flower.hoverSpeed + flower.phase
            );
            const driftWave = Math.cos(
                elapsedTime * flower.hoverSpeed * 0.73 + flower.phase
            );
            const colorBreath = 0.5 + 0.5 * Math.sin(
                elapsedTime * flower.colorSpeed + flower.colorPhase
            );

            flower.object.position.set(
                flower.basePosition.x + driftWave * flower.hoverAmplitude * 0.2,
                flower.basePosition.y + hoverWave * flower.hoverAmplitude,
                flower.basePosition.z
            );
            flower.object.rotation.z = flower.baseRotationZ +
                driftWave * FLOWER_SWAY_AMPLITUDE;

            flower.materials.forEach((entry) => {
                entry.material.emissive.copy(entry.baseEmissive).lerp(
                    entry.tint,
                    colorBreath * FLOWER_COLOR_BREATH_STRENGTH
                );
                entry.material.emissiveIntensity = entry.baseIntensity *
                    THREE.MathUtils.lerp(
                        FLOWER_BLOOM_MIN,
                        FLOWER_BLOOM_MAX,
                        colorBreath
                    );
            });
        });
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        disposeObject3D(this.group);
        this.group.clear();
        this.flowerAnimations.length = 0;
        this.particleField = null;
        this.bottomLight = null;
        this.bottomGlow = null;
    }
}

function createParticleField(size) {
    const count = window.matchMedia("(max-width: 760px)").matches
        ? PARTICLE_COUNT_MOBILE
        : PARTICLE_COUNT_DESKTOP;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const radii = new THREE.Vector3(
        size.x * PARTICLE_SPREAD_X,
        size.y * PARTICLE_SPREAD_Y,
        Math.max(size.z * PARTICLE_SPREAD_Z, size.x * 0.16)
    );
    const center = new THREE.Vector3(0, size.y * 0.04, 0);
    const palette = [
        new THREE.Color(0xffd5f5),
        new THREE.Color(0xd59cff),
        new THREE.Color(0xffffff),
        new THREE.Color(0xb56dff)
    ];

    for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        const radius = Math.cbrt(seededUnit(index, 20));
        const azimuth = seededUnit(index, 21) * Math.PI * 2;
        const vertical = seededUnit(index, 22) * 2 - 1;
        const horizontal = Math.sqrt(1 - vertical * vertical);
        const color = palette[index % palette.length];

        positions[offset] = center.x +
            Math.cos(azimuth) * horizontal * radius * radii.x;
        positions[offset + 1] = center.y +
            vertical * radius * radii.y;
        positions[offset + 2] = center.z +
            Math.sin(azimuth) * horizontal * radius * radii.z;

        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        map: createParticleTexture(),
        size: Math.max(size.x, size.y) * PARTICLE_SIZE,
        sizeAttenuation: true,
        transparent: true,
        opacity: PARTICLE_OPACITY,
        vertexColors: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
    });
    const points = new THREE.Points(geometry, material);

    points.name = "Central Brownian particle field";
    points.renderOrder = 4;

    return {
        points,
        positions,
        velocities,
        center,
        radii,
        randomState: 0x51f15e3d
    };
}

function updateParticleField(field, deltaTime) {
    if (!field) return;

    const timeStep = Math.min(deltaTime, 1 / 30);
    const noiseScale = PARTICLE_BROWNIAN_FORCE * Math.sqrt(timeStep);
    const drag = Math.exp(-PARTICLE_DRAG * timeStep);

    for (let offset = 0; offset < field.positions.length; offset += 3) {
        const dx = field.positions[offset] - field.center.x;
        const dy = field.positions[offset + 1] - field.center.y;
        const dz = field.positions[offset + 2] - field.center.z;

        field.velocities[offset] += (
            nextRandom(field) * 2 - 1
        ) * noiseScale - dx * PARTICLE_CENTERING_FORCE * timeStep;
        field.velocities[offset + 1] += (
            nextRandom(field) * 2 - 1
        ) * noiseScale - dy * PARTICLE_CENTERING_FORCE * timeStep;
        field.velocities[offset + 2] += (
            nextRandom(field) * 2 - 1
        ) * noiseScale - dz * PARTICLE_CENTERING_FORCE * timeStep;

        field.velocities[offset] *= drag;
        field.velocities[offset + 1] *= drag;
        field.velocities[offset + 2] *= drag;

        field.positions[offset] += field.velocities[offset] * timeStep;
        field.positions[offset + 1] += field.velocities[offset + 1] * timeStep;
        field.positions[offset + 2] += field.velocities[offset + 2] * timeStep;

        const normalizedRadius = Math.sqrt(
            Math.pow((field.positions[offset] - field.center.x) /
                field.radii.x, 2) +
            Math.pow((field.positions[offset + 1] - field.center.y) /
                field.radii.y, 2) +
            Math.pow((field.positions[offset + 2] - field.center.z) /
                field.radii.z, 2)
        );

        if (normalizedRadius > 1) {
            const correction = 1 / normalizedRadius;

            field.positions[offset] = field.center.x +
                (field.positions[offset] - field.center.x) * correction;
            field.positions[offset + 1] = field.center.y +
                (field.positions[offset + 1] - field.center.y) * correction;
            field.positions[offset + 2] = field.center.z +
                (field.positions[offset + 2] - field.center.z) * correction;
            field.velocities[offset] *= -0.28;
            field.velocities[offset + 1] *= -0.28;
            field.velocities[offset + 2] *= -0.28;
        }
    }

    field.points.geometry.attributes.position.needsUpdate = true;
}

function nextRandom(field) {
    let state = field.randomState;

    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    field.randomState = state >>> 0;
    return field.randomState / 4294967296;
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

function prepareFlower(flower, index, sourceMaterials) {
    const materials = [];
    const tint = FLOWER_TINTS[index % FLOWER_TINTS.length];

    flower.traverse((child) => {
        if (!child.isMesh) return;

        const childMaterials = Array.isArray(child.material)
            ? child.material
            : [child.material];
        const clonedMaterials = childMaterials.map((sourceMaterial) => {
            sourceMaterials.add(sourceMaterial);

            const material = sourceMaterial.clone();
            material.name = `${sourceMaterial.name} flower ${index + 1}`;
            material.needsUpdate = true;
            materials.push({
                material,
                tint,
                baseEmissive: material.emissive.clone(),
                baseIntensity: Math.min(
                    material.emissiveIntensity,
                    FLOWER_BASE_EMISSIVE_INTENSITY
                )
            });
            return material;
        });

        child.material = Array.isArray(child.material)
            ? clonedMaterials
            : clonedMaterials[0];
    });

    return {
        object: flower,
        materials,
        basePosition: flower.position.clone(),
        baseRotationZ: flower.rotation.z,
        hoverAmplitude: FLOWER_HOVER_AMPLITUDE *
            THREE.MathUtils.lerp(0.72, 1.18, seededUnit(index, 1)),
        hoverSpeed: THREE.MathUtils.lerp(
            FLOWER_HOVER_SPEED_MIN,
            FLOWER_HOVER_SPEED_MAX,
            seededUnit(index, 2)
        ),
        colorSpeed: THREE.MathUtils.lerp(0.54, 0.82, seededUnit(index, 3)),
        phase: seededUnit(index, 4) * Math.PI * 2,
        colorPhase: seededUnit(index, 5) * Math.PI * 2
    };
}

function seededUnit(index, salt) {
    const value = Math.sin(
        (index + 1) * 12.9898 + salt * 78.233
    ) * 43758.5453;

    return value - Math.floor(value);
}

function containsMesh(object) {
    let hasMesh = false;

    object.traverse((child) => {
        if (child.isMesh) hasMesh = true;
    });

    return hasMesh;
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
        if (!child.isMesh && !child.isSprite && !child.isPoints) return;

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
