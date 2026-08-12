import * as THREE from "three";

// Reference-matched portal proportions. All sizes remain relative to the scan.
export const PORTAL_COLOR = 0xd75cff;
export const PORTAL_CORE_COLOR = 0xf3c4ff;
export const PORTAL_RIPPLE_COUNT = 6;
export const PORTAL_RIPPLE_SPEED = 0.2;
export const PORTAL_RADIUS_WIDTH_RATIO = 1.05;
export const PORTAL_MINIMUM_HEIGHT_RATIO = 0.2;
export const PORTAL_MAXIMUM_HEIGHT_RATIO = 0.42;
export const PORTAL_FLATTENING = 0.62;
export const PORTAL_INNER_POOL_OPACITY = 0.34;
export const PORTAL_AREA_GLOW_OPACITY = 0.07;
export const PORTAL_CORE_RING_OPACITY = 0.44;
export const PORTAL_RIPPLE_OPACITY = 0.11;
export const PORTAL_RIPPLE_NOISE_STRENGTH = 0.24;
export const PORTAL_SURFACE_GLOW_HEIGHT_RATIO = 0.14;
export const PORTAL_SURFACE_GLOW_OPACITY = 0.16;
export const PORTAL_SURFACE_GLOW_STRENGTH = 1.22;

const temporaryPosition = new THREE.Vector3();

/**
 * Reference-styled portal plus a lower-body light reflection. The reflection
 * is vertex-colored on duplicate surface geometry instead of drawn as a
 * rectangular sprite, so its boundary follows the imported scan and fades
 * naturally upward.
 */
export class PortraitPortal {

    constructor(sourceModel, bounds, cutoffY) {

        if (!sourceModel?.isObject3D || !bounds || bounds.isEmpty()) {
            throw new Error("Portrait portal requires a valid model and bounds.");
        }

        if (!Number.isFinite(cutoffY)) {
            throw new Error("Portrait portal requires a valid portrait cutoff.");
        }

        this.group = new THREE.Group();
        this.group.name = "Portrait Portal";
        this.floorGroup = new THREE.Group();
        this.floorGroup.name = "Portrait Portal Floor";
        this.group.add(this.floorGroup);
        this.ripples = [];
        this.materials = [];
        this.geometries = [];
        this.textures = [];
        this.disposed = false;

        this.build(sourceModel, bounds, cutoffY);

    }

    get object3D() {

        return this.group;

    }

    build(sourceModel, bounds, cutoffY) {

        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = THREE.MathUtils.clamp(
            size.x * PORTAL_RADIUS_WIDTH_RATIO,
            size.y * PORTAL_MINIMUM_HEIGHT_RATIO,
            size.y * PORTAL_MAXIMUM_HEIGHT_RATIO
        );

        this.floorGroup.position.set(
            center.x,
            cutoffY + size.y * 0.003,
            center.z
        );
        this.addFinishingAura(radius);
        this.addInnerPool(radius);
        this.addCoreRing(radius);
        this.addRipples(radius);
        this.addSurfaceGlow(sourceModel, size.y, cutoffY);

    }

    addFinishingAura(radius) {

        const texture = createAreaGlowTexture();
        const geometry = new THREE.PlaneGeometry(radius * 3.15, radius * 3.15);
        const material = createGlowMaterial(
            PORTAL_COLOR,
            PORTAL_AREA_GLOW_OPACITY,
            1.05,
            texture
        );
        const aura = createFloorPlane(geometry, material, -0.006, 1);

        aura.name = "Portal Finishing Aura";
        this.floorGroup.add(aura);
        this.finishingAura = aura;
        this.track(geometry, material, texture);

    }

    addInnerPool(radius) {

        const texture = createInnerPoolTexture();
        const geometry = new THREE.PlaneGeometry(radius * 1.62, radius * 1.62);
        const material = createGlowMaterial(
            PORTAL_CORE_COLOR,
            PORTAL_INNER_POOL_OPACITY,
            2.05,
            texture
        );
        const pool = createFloorPlane(geometry, material, -0.002, 2);

        pool.name = "Portal Bright Inner Pool";
        this.floorGroup.add(pool);
        this.innerPool = pool;
        this.track(geometry, material, texture);

    }

    addCoreRing(radius) {

        const texture = createRippleTexture(512, 0.735, 0.0085, 0.12);
        const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
        const material = createGlowMaterial(
            PORTAL_CORE_COLOR,
            PORTAL_CORE_RING_OPACITY,
            2.25,
            texture
        );
        const ring = createFloorPlane(geometry, material, 0.002, 4);

        ring.name = "Portal Core Ring";
        this.floorGroup.add(ring);
        this.coreRing = ring;
        this.track(geometry, material, texture);

    }

    addRipples(radius) {

        for (let index = 0; index < PORTAL_RIPPLE_COUNT; index++) {

            const texture = createRippleTexture(
                384,
                0.735,
                0.0065,
                PORTAL_RIPPLE_NOISE_STRENGTH,
                index + 1
            );
            const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
            const material = createGlowMaterial(
                PORTAL_COLOR,
                PORTAL_RIPPLE_OPACITY,
                1.65,
                texture
            );
            const mesh = createFloorPlane(geometry, material, 0, 3);

            mesh.name = `Portal Ripple ${index + 1}`;
            this.floorGroup.add(mesh);
            this.ripples.push({
                mesh,
                material,
                phaseOffset: index / PORTAL_RIPPLE_COUNT
            });
            this.track(geometry, material, texture);

        }

    }

    addSurfaceGlow(sourceModel, modelHeight, cutoffY) {

        const glowHeight = modelHeight * PORTAL_SURFACE_GLOW_HEIGHT_RATIO;
        const material = createSurfaceGlowMaterial(cutoffY);
        let surfaceCount = 0;

        sourceModel.updateWorldMatrix(true, true);

        sourceModel.traverse((sourceMesh) => {

            if (!sourceMesh.isMesh || !sourceMesh.geometry?.attributes.position) {
                return;
            }

            try {

                const geometry = createSurfaceGlowGeometry(
                    sourceMesh,
                    cutoffY,
                    glowHeight
                );
                const mesh = new THREE.Mesh(geometry, material);

                mesh.name = `${sourceMesh.name || "Imported Mesh"} Portal Reflection`;
                mesh.matrixAutoUpdate = false;
                mesh.matrix.copy(sourceMesh.matrixWorld);
                mesh.frustumCulled = sourceMesh.frustumCulled;
                mesh.renderOrder = 7;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                this.group.add(mesh);
                this.geometries.push(geometry);
                surfaceCount++;

            } catch (error) {

                console.warn(
                    `Skipping portal reflection for ${sourceMesh.name || "mesh"}.`,
                    error
                );

            }

        });

        if (surfaceCount > 0) {

            this.surfaceGlowMaterial = material;
            this.materials.push(material);

        } else {

            material.dispose();

        }

    }

    update(_deltaTime, elapsedTime) {

        if (this.disposed || !this.group.visible) return;

        this.ripples.forEach((ripple) => {

            const progress = (
                elapsedTime * PORTAL_RIPPLE_SPEED + ripple.phaseOffset
            ) % 1;
            const scale = 0.88 + progress * 0.82;
            const fade = 1 - progress;

            ripple.mesh.scale.set(scale, scale * PORTAL_FLATTENING, 1);
            ripple.mesh.position.y = progress * 0.005;
            ripple.material.opacity =
                fade * fade * PORTAL_RIPPLE_OPACITY;

        });

        const pulse = 0.5 + Math.sin(elapsedTime * 1.35) * 0.5;
        const coreScale = 0.99 + pulse * 0.014;

        this.coreRing.material.opacity =
            PORTAL_CORE_RING_OPACITY * (0.88 + pulse * 0.12);
        this.coreRing.scale.set(
            coreScale,
            coreScale * PORTAL_FLATTENING,
            1
        );
        this.innerPool.material.opacity =
            PORTAL_INNER_POOL_OPACITY * (0.9 + pulse * 0.1);
        this.finishingAura.material.opacity =
            PORTAL_AREA_GLOW_OPACITY * (0.9 + pulse * 0.1);

        if (this.surfaceGlowMaterial) {
            this.surfaceGlowMaterial.opacity =
                PORTAL_SURFACE_GLOW_OPACITY * (0.92 + pulse * 0.08);
        }

    }

    show() {

        this.group.visible = true;

    }

    hide() {

        this.group.visible = false;

    }

    dispose() {

        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        this.geometries.forEach((geometry) => geometry.dispose());
        this.materials.forEach((material) => material.dispose());
        this.textures.forEach((texture) => texture.dispose());
        this.ripples.length = 0;
        this.geometries.length = 0;
        this.materials.length = 0;
        this.textures.length = 0;
        this.group.clear();

    }

    track(geometry, material, texture = null) {

        this.geometries.push(geometry);
        this.materials.push(material);
        if (texture) this.textures.push(texture);

    }

}

function createFloorPlane(geometry, material, y, renderOrder) {

    const mesh = new THREE.Mesh(geometry, material);

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.scale.y = PORTAL_FLATTENING;
    mesh.renderOrder = renderOrder;

    return mesh;

}

function createSurfaceGlowGeometry(sourceMesh, cutoffY, glowHeight) {

    const geometry = sourceMesh.geometry.clone();
    const positions = geometry.getAttribute("position");

    if (sourceMesh.isSkinnedMesh &&
        typeof sourceMesh.applyBoneTransform === "function") {

        sourceMesh.skeleton?.update();

        for (let index = 0; index < positions.count; index++) {

            temporaryPosition.fromBufferAttribute(positions, index);
            sourceMesh.applyBoneTransform(index, temporaryPosition);
            positions.setXYZ(
                index,
                temporaryPosition.x,
                temporaryPosition.y,
                temporaryPosition.z
            );

        }

        positions.needsUpdate = true;

    }

    const glowColor = new THREE.Color(PORTAL_CORE_COLOR)
        .multiplyScalar(PORTAL_SURFACE_GLOW_STRENGTH);
    const colors = new Float32Array(positions.count * 3);

    for (let index = 0; index < positions.count; index++) {

        temporaryPosition.fromBufferAttribute(positions, index)
            .applyMatrix4(sourceMesh.matrixWorld);

        const normalizedHeight = THREE.MathUtils.clamp(
            (temporaryPosition.y - cutoffY) / glowHeight,
            0,
            1
        );
        const smoothHeight = normalizedHeight * normalizedHeight *
            (3 - 2 * normalizedHeight);
        const strength = Math.pow(1 - smoothHeight, 2.25);
        const offset = index * 3;

        colors[offset] = glowColor.r * strength;
        colors[offset + 1] = glowColor.g * strength;
        colors[offset + 2] = glowColor.b * strength;

    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;

}

function createSurfaceGlowMaterial(cutoffY) {

    return new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.FrontSide,
        transparent: true,
        opacity: PORTAL_SURFACE_GLOW_OPACITY,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        clippingPlanes: [
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutoffY)
        ]
    });

}

function createGlowMaterial(colorValue, opacity, brightness, map) {

    const color = new THREE.Color(colorValue).multiplyScalar(brightness);

    return new THREE.MeshBasicMaterial({
        color,
        map,
        transparent: true,
        opacity,
        alphaTest: 0.004,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
    });

}

function createInnerPoolTexture() {

    return createRadialTexture([
        [0, 0.95],
        [0.2, 0.72],
        [0.48, 0.28],
        [0.76, 0.07],
        [1, 0]
    ]);

}

function createAreaGlowTexture() {

    return createRadialTexture([
        [0, 0.42],
        [0.36, 0.24],
        [0.7, 0.08],
        [0.92, 0.012],
        [1, 0]
    ]);

}

function createRadialTexture(stops, size = 256) {

    const canvas = createTextureCanvas(size);
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

    stops.forEach(([position, alpha]) => {
        gradient.addColorStop(position, `rgba(255, 255, 255, ${alpha})`);
    });
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    return createCanvasTexture(canvas);

}

function createRippleTexture(
    size,
    ringCenter,
    lineWidth,
    noiseStrength,
    seed = 0
) {

    const canvas = createTextureCanvas(size);
    const context = canvas.getContext("2d");
    const image = context.createImageData(size, size);

    for (let y = 0; y < size; y++) {

        const normalizedY = (y + 0.5) / size * 2 - 1;

        for (let x = 0; x < size; x++) {

            const normalizedX = (x + 0.5) / size * 2 - 1;
            const radius = Math.hypot(normalizedX, normalizedY);

            if (radius > 1) continue;

            const angle = Math.atan2(normalizedY, normalizedX);
            const warpedCenter = ringCenter +
                Math.sin(angle * 9 + seed * 0.73) * 0.0024 +
                Math.sin(angle * 23 - seed * 0.41) * 0.0012;
            const distance = Math.abs(radius - warpedCenter);
            const line = Math.exp(-Math.pow(distance / lineWidth, 2));
            const halo = Math.exp(-Math.pow(distance / (lineWidth * 4.8), 2)) *
                0.1;
            const angularNoise =
                Math.sin(angle * 11 + seed) * 0.45 +
                Math.sin(angle * 29 - seed * 0.6) * 0.22 +
                (deterministicNoise(x, y, seed) - 0.5) * 0.34;
            const variation = THREE.MathUtils.clamp(
                1 + angularNoise * noiseStrength,
                0.48,
                1.25
            );
            const alpha = THREE.MathUtils.clamp(
                line * variation + halo,
                0,
                1
            );
            const offset = (y * size + x) * 4;

            image.data[offset] = 255;
            image.data[offset + 1] = 255;
            image.data[offset + 2] = 255;
            image.data[offset + 3] = Math.round(alpha * 255);

        }

    }

    context.putImageData(image, 0, 0);

    return createCanvasTexture(canvas);

}

function deterministicNoise(x, y, seed) {

    const value = Math.sin(
        x * 12.9898 + y * 78.233 + seed * 37.719
    ) * 43758.5453;

    return value - Math.floor(value);

}

function createTextureCanvas(size) {

    const canvas = document.createElement("canvas");

    canvas.width = size;
    canvas.height = size;

    return canvas;

}

function createCanvasTexture(canvas) {

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return texture;

}
