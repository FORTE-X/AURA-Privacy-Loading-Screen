import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const FLORAL_VINE_OPACITY = 0.4;
export const FLORAL_FLOWER_OPACITY = 0.98;
export const FLORAL_OVERLAY_HEIGHT_RATIO = 0.94;
export const FLORAL_OVERLAY_SURFACE_OFFSET_RATIO = 0.025;
export const FLORAL_FLOWER_HOVER_STRENGTH = 0.0035;
export const FLORAL_FLOWER_SWAY_STRENGTH = 0.025;
export const FLORAL_FLOWER_PULSE_STRENGTH = 0.018;

const ASSET_URLS = {
    vine: new URL("./assets/b1.glb", import.meta.url).href,
    ivoryLily: new URL("./assets/ivory-lily.glb", import.meta.url).href,
    lavenderStar: new URL("./assets/lavender-star.glb", import.meta.url).href,
    moonbellBlossom: new URL(
        "./assets/moonbell-blossom.glb",
        import.meta.url
    ).href,
    periwinkleBloom: new URL(
        "./assets/periwinkle-bloom.glb",
        import.meta.url
    ).href,
    whiteJasmine: new URL("./assets/white-jasmine.glb", import.meta.url).href
};

const FLOWER_PLACEMENTS = [
    {
        asset: "ivoryLily",
        name: "Hair Ivory Lily",
        x: -0.18,
        y: 0.855,
        size: 0.115,
        rotation: -0.18,
        phase: 0.25,
        palette: [0xfffbff, 0xffbce9, 0xb55fff]
    },
    {
        asset: "whiteJasmine",
        name: "Upper White Jasmine",
        x: -0.145,
        y: 0.69,
        size: 0.078,
        rotation: 0.22,
        phase: 1.6,
        palette: [0xffffff, 0xffc7ea, 0xd979ff]
    },
    {
        asset: "lavenderStar",
        name: "Chest Lavender Star",
        x: 0.145,
        y: 0.645,
        size: 0.1,
        rotation: -0.2,
        phase: 2.75,
        palette: [0xfff8ff, 0xdc9bff, 0x7657ff]
    },
    {
        asset: "moonbellBlossom",
        name: "Waist Moonbell Blossom",
        x: 0.075,
        y: 0.455,
        size: 0.073,
        rotation: 0.14,
        phase: 4.15,
        palette: [0xfff8ff, 0xf39fe6, 0xa956ff]
    },
    {
        asset: "periwinkleBloom",
        name: "Hip Periwinkle Bloom",
        x: -0.115,
        y: 0.265,
        size: 0.125,
        rotation: -0.1,
        phase: 5.4,
        palette: [0xfff7ff, 0xc89cff, 0x735aff]
    }
];

const gltfLoader = new GLTFLoader();
const templatePromises = new Map();
const temporaryPosition = new THREE.Vector3();
const temporaryColor = new THREE.Color();
const gradientColorA = new THREE.Color();
const gradientColorB = new THREE.Color();
const gradientColorC = new THREE.Color();

/**
 * A pose-independent ornamental composition. The imported model contributes
 * only its portrait bounds; the authored vine and focal-flower arrangement is
 * never regenerated or fitted to limbs.
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
        this.group.name = "Pose-Independent Front Floral Composition";
        this.materials = [];
        this.geometries = [];
        this.textures = [];
        this.flowerAnchors = [];
        this.disposed = false;
        this.initializationId = 0;

    }

    get object3D() {

        return this.group;

    }

    async initialize() {

        if (this.disposed) return false;

        const initializationId = ++this.initializationId;
        const [vineTemplate, ...flowerTemplates] = await Promise.all([
            loadTemplate("vine"),
            ...FLOWER_PLACEMENTS.map((placement) =>
                loadTemplate(placement.asset)
            )
        ]);

        if (this.disposed || initializationId !== this.initializationId) {
            return false;
        }

        const vineContent = vineTemplate.clone(true);
        const vineBounds = new THREE.Box3().setFromObject(vineContent);

        if (vineBounds.isEmpty()) {
            throw new Error("The floral vine asset contains no visible geometry.");
        }

        const vineSize = vineBounds.getSize(new THREE.Vector3());

        if (vineSize.y <= Number.EPSILON) {
            throw new Error("The floral vine asset has an invalid height.");
        }

        const vineCenter = vineBounds.getCenter(new THREE.Vector3());
        const modelSize = this.bounds.getSize(new THREE.Vector3());
        const modelCenter = this.bounds.getCenter(new THREE.Vector3());
        const visibleHeight = this.bounds.max.y - this.cutoffY;
        const uniformScale = (
            visibleHeight * FLORAL_OVERLAY_HEIGHT_RATIO
        ) / vineSize.y;
        const surfaceOffset = Math.max(
            modelSize.z * FLORAL_OVERLAY_SURFACE_OFFSET_RATIO,
            modelSize.y * 0.002
        );

        this.vineMaterial = createVineMaterial(this.cutoffY);
        this.flowerMaterial = createFlowerMaterial(this.cutoffY);
        this.glowTexture = createGlowTexture();
        this.materials.push(this.vineMaterial, this.flowerMaterial);
        this.textures.push(this.glowTexture);

        applyVineGradient(
            vineContent,
            vineBounds,
            this.vineMaterial,
            this.geometries
        );
        vineContent.name = "Authored b1 Vine Foundation";
        vineContent.position.copy(vineCenter).multiplyScalar(-1);
        this.group.add(vineContent);

        FLOWER_PLACEMENTS.forEach((placement, index) => {
            this.addFocalFlower(
                flowerTemplates[index],
                placement,
                vineSize,
                visibleHeight,
                uniformScale
            );
        });

        this.group.scale.setScalar(uniformScale);
        this.group.position.set(
            modelCenter.x,
            this.cutoffY + visibleHeight * 0.5,
            this.bounds.max.z + surfaceOffset
        );

        return true;

    }

    addFocalFlower(
        template,
        placement,
        vineSize,
        visibleHeight,
        uniformScale
    ) {

        const flowerContent = template.clone(true);
        const flowerBounds = new THREE.Box3().setFromObject(flowerContent);

        if (flowerBounds.isEmpty()) {
            throw new Error(`${placement.name} contains no visible geometry.`);
        }

        const flowerSize = flowerBounds.getSize(new THREE.Vector3());
        const flowerCenter = flowerBounds.getCenter(new THREE.Vector3());
        const footprint = Math.max(flowerSize.x, flowerSize.z);

        if (footprint <= Number.EPSILON) {
            throw new Error(`${placement.name} has an invalid footprint.`);
        }

        applyFlowerGradient(
            flowerContent,
            flowerBounds,
            placement.palette,
            this.flowerMaterial,
            this.geometries
        );

        const anchor = new THREE.Group();
        const facingGroup = new THREE.Group();
        const targetDiameter = visibleHeight * placement.size / uniformScale;
        const scale = targetDiameter / footprint;
        const localDepth = vineSize.z * 0.5 + targetDiameter * 0.08;

        anchor.name = placement.name;
        anchor.position.set(
            placement.x * vineSize.x,
            (placement.y - 0.5) * vineSize.y,
            localDepth
        );
        anchor.rotation.z = placement.rotation;
        anchor.scale.setScalar(scale);

        facingGroup.rotation.x = Math.PI / 2;
        flowerContent.position.copy(flowerCenter).multiplyScalar(-1);
        flowerContent.name = `${placement.name} Geometry`;
        facingGroup.add(flowerContent);
        anchor.add(facingGroup);

        const glowMaterial = createFlowerGlowMaterial(
            placement.palette[1],
            this.cutoffY,
            this.glowTexture
        );
        const glow = new THREE.Sprite(glowMaterial);

        glow.name = `${placement.name} Soft Glow`;
        glow.position.z = -flowerSize.y * 0.3;
        glow.scale.setScalar(footprint * 1.85);
        glow.renderOrder = 10;
        anchor.add(glow);
        this.materials.push(glowMaterial);

        this.group.add(anchor);
        this.flowerAnchors.push({
            anchor,
            glowMaterial,
            baseY: anchor.position.y,
            baseRotation: placement.rotation,
            baseScale: scale,
            phase: placement.phase
        });

    }

    update(_deltaTime, elapsedTime) {

        if (this.disposed || !this.group.visible) return;

        const designHeight = this.bounds.max.y - this.cutoffY;
        const localHover = (
            designHeight * FLORAL_FLOWER_HOVER_STRENGTH
        ) / Math.max(this.group.scale.y, Number.EPSILON);

        this.flowerAnchors.forEach((flower, index) => {
            const wave = Math.sin(elapsedTime * 0.72 + flower.phase);
            const secondaryWave = Math.sin(
                elapsedTime * 1.08 + flower.phase * 1.37
            );
            const pulse = 1 + secondaryWave * FLORAL_FLOWER_PULSE_STRENGTH;

            flower.anchor.position.y = flower.baseY + wave * localHover;
            flower.anchor.rotation.z = flower.baseRotation +
                secondaryWave * FLORAL_FLOWER_SWAY_STRENGTH;
            flower.anchor.scale.setScalar(flower.baseScale * pulse);
            flower.glowMaterial.opacity = 0.035 +
                (0.5 + wave * 0.5) * (0.014 + index * 0.001);
        });

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
        this.geometries.forEach((geometry) => geometry.dispose());
        this.materials.forEach((material) => material.dispose());
        this.textures.forEach((texture) => texture.dispose());
        this.flowerAnchors.length = 0;
        this.geometries.length = 0;
        this.materials.length = 0;
        this.textures.length = 0;

    }

}

function loadTemplate(assetName) {

    if (!templatePromises.has(assetName)) {
        const promise = gltfLoader.loadAsync(ASSET_URLS[assetName])
            .then((gltf) => {
                const template = gltf.scene;
                let meshCount = 0;

                template.traverse((child) => {
                    if (child.isMesh) meshCount++;
                });

                if (meshCount === 0) {
                    throw new Error(`${assetName} contains no renderable meshes.`);
                }

                template.updateMatrixWorld(true);
                return template;
            })
            .catch((error) => {
                templatePromises.delete(assetName);
                throw new Error(
                    `Unable to load floral asset ${assetName}: ${error.message}`
                );
            });

        templatePromises.set(assetName, promise);
    }

    return templatePromises.get(assetName);

}

function applyVineGradient(content, bounds, material, ownedGeometries) {

    const height = Math.max(bounds.max.y - bounds.min.y, Number.EPSILON);

    content.updateWorldMatrix(true, true);
    content.traverse((child) => {
        if (!child.isMesh || !child.geometry?.attributes.position) return;

        const geometry = child.geometry.clone();
        const positions = geometry.getAttribute("position");
        const colors = new Float32Array(positions.count * 3);

        for (let index = 0; index < positions.count; index++) {
            temporaryPosition.fromBufferAttribute(positions, index)
                .applyMatrix4(child.matrixWorld);

            const heightProgress = THREE.MathUtils.clamp(
                (temporaryPosition.y - bounds.min.y) / height,
                0,
                1
            );
            const shimmer = 0.9 +
                Math.sin(heightProgress * Math.PI * 4) * 0.08;

            sampleThreeColorGradient(
                0x8146d9,
                0xf27bdc,
                0xc75cff,
                heightProgress,
                temporaryColor
            ).multiplyScalar(shimmer);
            temporaryColor.toArray(colors, index * 3);
        }

        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        child.geometry = geometry;
        child.material = material;
        child.castShadow = false;
        child.receiveShadow = false;
        child.renderOrder = 9;
        ownedGeometries.push(geometry);
    });

}

function applyFlowerGradient(
    content,
    bounds,
    palette,
    material,
    ownedGeometries
) {

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maximumRadius = Math.max(size.x, size.z) * 0.5;

    content.updateWorldMatrix(true, true);
    content.traverse((child) => {
        if (!child.isMesh || !child.geometry?.attributes.position) return;

        const geometry = child.geometry.clone();
        const positions = geometry.getAttribute("position");
        const colors = new Float32Array(positions.count * 3);

        for (let index = 0; index < positions.count; index++) {
            temporaryPosition.fromBufferAttribute(positions, index)
                .applyMatrix4(child.matrixWorld);

            const radialProgress = THREE.MathUtils.clamp(
                Math.hypot(
                    temporaryPosition.x - center.x,
                    temporaryPosition.z - center.z
                ) / Math.max(maximumRadius, Number.EPSILON),
                0,
                1
            );
            const easedProgress = Math.pow(radialProgress, 0.72);
            const depthHighlight = THREE.MathUtils.clamp(
                (temporaryPosition.y - bounds.min.y) /
                    Math.max(size.y, Number.EPSILON),
                0,
                1
            );
            const brightness = 0.62 +
                (1 - easedProgress) * 0.24 +
                depthHighlight * 0.04;

            sampleThreeColorGradient(
                palette[0],
                palette[1],
                palette[2],
                easedProgress,
                temporaryColor
            ).multiplyScalar(brightness);
            temporaryColor.toArray(colors, index * 3);
        }

        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        child.geometry = geometry;
        child.material = material;
        child.castShadow = false;
        child.receiveShadow = false;
        child.renderOrder = 11;
        ownedGeometries.push(geometry);
    });

}

function sampleThreeColorGradient(start, middle, end, progress, target) {

    gradientColorA.setHex(start);
    gradientColorB.setHex(middle);
    gradientColorC.setHex(end);

    if (progress <= 0.52) {
        return target.copy(gradientColorA).lerp(
            gradientColorB,
            progress / 0.52
        );
    }

    return target.copy(gradientColorB).lerp(
        gradientColorC,
        (progress - 0.52) / 0.48
    );

}

function createVineMaterial(cutoffY) {

    return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: FLORAL_VINE_OPACITY,
        depthTest: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
        clippingPlanes: createPortraitClippingPlanes(cutoffY)
    });

}

function createFlowerMaterial(cutoffY) {

    return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: FLORAL_FLOWER_OPACITY,
        depthTest: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
        clippingPlanes: createPortraitClippingPlanes(cutoffY)
    });

}

function createFlowerGlowMaterial(color, cutoffY, map) {

    return new THREE.SpriteMaterial({
        color,
        map,
        transparent: true,
        opacity: 0.026,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        clippingPlanes: createPortraitClippingPlanes(cutoffY)
    });

}

function createPortraitClippingPlanes(cutoffY) {

    return [new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutoffY)];

}

function createGlowTexture(size = 128) {

    const canvas = document.createElement("canvas");

    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    const center = size * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    gradient.addColorStop(0.24, "rgba(255, 255, 255, 0.35)");
    gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.08)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return texture;

}
