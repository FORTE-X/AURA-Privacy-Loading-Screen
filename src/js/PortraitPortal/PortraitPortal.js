import * as THREE from "three";

export const PORTAL_COLOR = 0xe36cff;
export const PORTAL_RIPPLE_COUNT = 4;
export const PORTAL_RIPPLE_SPEED = 0.32;
export const PORTAL_RADIUS_WIDTH_RATIO = 0.62;
export const PORTAL_RIPPLE_OPACITY = 0.075;
export const PORTAL_INNER_GLOW_OPACITY = 0.25;
export const PORTAL_AREA_GLOW_OPACITY = 0.075;
export const PORTAL_RIPPLE_NOISE_STRENGTH = 0.38;
export const PORTAL_SURFACE_GLOW_HEIGHT_RATIO = 0.2;
export const PORTAL_SURFACE_GLOW_OPACITY = 0.28;
export const PORTAL_SURFACE_GLOW_STRENGTH = 1.45;

const temporaryPosition = new THREE.Vector3();

/**
 * Owns the portal and a surface-conforming lower-body light wash. The wash is
 * vertex-colored directly from the model's height, so it cannot reveal a
 * rectangular sprite boundary in front of or behind the silhouette.
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
        this.portalGroup = new THREE.Group();
        this.portalGroup.name = "Portrait Portal Rings";
        this.group.add(this.portalGroup);
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
            size.y * 0.16,
            size.y * 0.28
        );

        this.portalGroup.position.set(
            center.x,
            cutoffY + size.y * 0.003,
            center.z
        );
        this.addCoreGlow(radius);
        this.addRipples(radius);
        this.addSurfaceGlow(sourceModel, size.y, cutoffY);

    }

    addCoreGlow(radius) {

        const areaTexture = createAreaGlowTexture();
        const areaGeometry = new THREE.PlaneGeometry(radius * 3, radius * 3);
        const areaMaterial = createGlowMaterial(
            PORTAL_AREA_GLOW_OPACITY,
            1.25,
            areaTexture
        );
        const areaGlow = new THREE.Mesh(areaGeometry, areaMaterial);

        areaGlow.name = "Portal Finishing Aura";
        areaGlow.rotation.x = -Math.PI / 2;
        areaGlow.position.y = -0.004;
        areaGlow.scale.y = 0.7;
        areaGlow.renderOrder = 1;
        this.portalGroup.add(areaGlow);
        this.areaGlow = areaGlow;
        this.geometries.push(areaGeometry);
        this.materials.push(areaMaterial);
        this.textures.push(areaTexture);

        const diskTexture = createSoftDiskTexture();
        const diskGeometry = new THREE.PlaneGeometry(radius * 2.15, radius * 2.15);
        const diskMaterial = createGlowMaterial(0.065, 1.1, diskTexture);
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);

        disk.name = "Portal Soft Disk";
        disk.rotation.x = -Math.PI / 2;
        disk.position.y = -0.002;
        disk.scale.y = 0.68;
        disk.renderOrder = 2;
        this.portalGroup.add(disk);
        this.geometries.push(diskGeometry);
        this.materials.push(diskMaterial);
        this.textures.push(diskTexture);

        const innerTexture = createInnerGlowTexture();
        const innerGeometry = new THREE.PlaneGeometry(radius * 1.55, radius * 1.55);
        const innerMaterial = createGlowMaterial(
            PORTAL_INNER_GLOW_OPACITY,
            2.2,
            innerTexture
        );
        const innerGlow = new THREE.Mesh(innerGeometry, innerMaterial);

        innerGlow.name = "Portal Bright Inner Pool";
        innerGlow.rotation.x = -Math.PI / 2;
        innerGlow.position.y = 0.001;
        innerGlow.scale.y = 0.68;
        innerGlow.renderOrder = 3;
        this.portalGroup.add(innerGlow);
        this.innerGlow = innerGlow;
        this.geometries.push(innerGeometry);
        this.materials.push(innerMaterial);
        this.textures.push(innerTexture);

        const ringTexture = createSoftRingTexture();
        const coreGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
        const coreMaterial = createGlowMaterial(0.2, 1.75, ringTexture);
        const coreRing = new THREE.Mesh(coreGeometry, coreMaterial);

        coreRing.name = "Portal Core Ring";
        coreRing.rotation.x = -Math.PI / 2;
        coreRing.position.y = 0.003;
        coreRing.scale.y = 0.68;
        coreRing.renderOrder = 4;
        this.portalGroup.add(coreRing);
        this.coreRing = coreRing;
        this.geometries.push(coreGeometry);
        this.materials.push(coreMaterial);
        this.textures.push(ringTexture);

    }

    addRipples(radius) {

        for (let index = 0; index < PORTAL_RIPPLE_COUNT; index++) {

            const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
            const material = createGlowMaterial(
                PORTAL_RIPPLE_OPACITY,
                1.75,
                this.coreRing.material.map
            );
            const mesh = new THREE.Mesh(geometry, material);

            mesh.name = `Portal Ripple ${index + 1}`;
            mesh.rotation.x = -Math.PI / 2;
            mesh.renderOrder = 3;
            this.portalGroup.add(mesh);
            this.ripples.push({
                mesh,
                material,
                phaseOffset: index / PORTAL_RIPPLE_COUNT,
                baseRotation: index * 1.37,
                rotationDirection: index % 2 === 0 ? 1 : -1
            });
            this.geometries.push(geometry);
            this.materials.push(material);

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

                mesh.name = `${sourceMesh.name || "Imported Mesh"} Portal Light`;
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
                    `Skipping portal surface light for ${sourceMesh.name || "mesh"}.`,
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
            const scale = 0.92 + progress * 0.72;
            const fade = 1 - progress;

            ripple.mesh.scale.set(scale, scale * 0.68, 1);
            ripple.mesh.position.y = progress * 0.008;
            ripple.mesh.rotation.z = ripple.baseRotation +
                elapsedTime * 0.025 * ripple.rotationDirection;
            ripple.material.opacity = fade * fade * PORTAL_RIPPLE_OPACITY;

        });

        const pulse = 0.5 + Math.sin(elapsedTime * 1.8) * 0.5;
        const coreScale = 0.985 + pulse * 0.025;

        this.coreRing.material.opacity = 0.15 + pulse * 0.05;
        this.coreRing.scale.set(coreScale, coreScale * 0.68, 1);
        this.innerGlow.material.opacity =
            PORTAL_INNER_GLOW_OPACITY * (0.86 + pulse * 0.14);
        this.areaGlow.material.opacity =
            PORTAL_AREA_GLOW_OPACITY * (0.82 + pulse * 0.18);

        if (this.surfaceGlowMaterial) {
            this.surfaceGlowMaterial.opacity =
                PORTAL_SURFACE_GLOW_OPACITY * (0.86 + pulse * 0.14);
        }

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

    const glowColor = new THREE.Color(PORTAL_COLOR)
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
        const strength = Math.pow(1 - smoothHeight, 1.65);
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

function createGlowMaterial(opacity, brightness, map) {

    const color = new THREE.Color(PORTAL_COLOR).multiplyScalar(brightness);

    return new THREE.MeshBasicMaterial({
        color,
        map,
        transparent: true,
        opacity,
        alphaTest: 0.006,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
    });

}

function createSoftDiskTexture() {

    const canvas = createTextureCanvas();
    const context = canvas.getContext("2d");
    const center = canvas.width * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    gradient.addColorStop(0.42, "rgba(255, 255, 255, 0.18)");
    gradient.addColorStop(0.78, "rgba(255, 255, 255, 0.045)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return createCanvasTexture(canvas);

}

function createInnerGlowTexture() {

    const canvas = createTextureCanvas();
    const context = canvas.getContext("2d");
    const center = canvas.width * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.72)");
    gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(0.88, "rgba(255, 255, 255, 0.025)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return createCanvasTexture(canvas);

}

function createAreaGlowTexture() {

    const canvas = createTextureCanvas();
    const context = canvas.getContext("2d");
    const center = canvas.width * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 0.56)");
    gradient.addColorStop(0.38, "rgba(255, 255, 255, 0.3)");
    gradient.addColorStop(0.72, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(0.92, "rgba(255, 255, 255, 0.018)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return createCanvasTexture(canvas);

}

function createSoftRingTexture() {

    const canvas = createTextureCanvas(384);
    const context = canvas.getContext("2d");
    const image = context.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {

        const normalizedY = (y + 0.5) / canvas.height * 2 - 1;

        for (let x = 0; x < canvas.width; x++) {

            const normalizedX = (x + 0.5) / canvas.width * 2 - 1;
            const radius = Math.sqrt(
                normalizedX * normalizedX + normalizedY * normalizedY
            );

            if (radius > 1) continue;

            const angle = Math.atan2(normalizedY, normalizedX);
            const ringCenter = 0.735 +
                Math.sin(angle * 7 + 0.8) * 0.005 +
                Math.sin(angle * 19 - 1.4) * 0.0025;
            const distance = Math.abs(radius - ringCenter);
            const thinLine = Math.exp(-Math.pow(distance / 0.011, 2));
            const softHalo = Math.exp(-Math.pow(distance / 0.043, 2)) * 0.14;
            const grain = deterministicNoise(x, y);
            const angularNoise =
                Math.sin(angle * 13 + 0.4) * 0.5 +
                Math.sin(angle * 31 - 1.2) * 0.25 +
                (grain - 0.5) * 0.5;
            const variation = THREE.MathUtils.clamp(
                1 + angularNoise * PORTAL_RIPPLE_NOISE_STRENGTH,
                0.28,
                1.35
            );
            const alpha = THREE.MathUtils.clamp(
                thinLine * variation + softHalo,
                0,
                1
            );
            const offset = (y * canvas.width + x) * 4;

            image.data[offset] = 255;
            image.data[offset + 1] = 255;
            image.data[offset + 2] = 255;
            image.data[offset + 3] = Math.round(alpha * 255);

        }

    }

    context.putImageData(image, 0, 0);

    return createCanvasTexture(canvas);

}

function deterministicNoise(x, y) {

    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;

    return value - Math.floor(value);

}

function createTextureCanvas(size = 256) {

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
