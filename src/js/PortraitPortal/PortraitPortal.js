import * as THREE from "three";

export const PORTAL_COLOR = 0xe36cff;
export const PORTAL_RIPPLE_COUNT = 4;
export const PORTAL_RIPPLE_SPEED = 0.32;
export const PORTAL_RADIUS_WIDTH_RATIO = 0.62;
export const PORTAL_RIPPLE_OPACITY = 0.1;
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

        const diskTexture = createSoftDiskTexture();
        const diskGeometry = new THREE.PlaneGeometry(radius * 2.15, radius * 2.15);
        const diskMaterial = createGlowMaterial(0.065, 1.1, diskTexture);
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);

        disk.name = "Portal Soft Disk";
        disk.rotation.x = -Math.PI / 2;
        disk.scale.y = 0.68;
        disk.renderOrder = 2;
        this.portalGroup.add(disk);
        this.geometries.push(diskGeometry);
        this.materials.push(diskMaterial);
        this.textures.push(diskTexture);

        const ringTexture = createSoftRingTexture();
        const coreGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
        const coreMaterial = createGlowMaterial(0.2, 1.75, ringTexture);
        const coreRing = new THREE.Mesh(coreGeometry, coreMaterial);

        coreRing.name = "Portal Core Ring";
        coreRing.rotation.x = -Math.PI / 2;
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
                phaseOffset: index / PORTAL_RIPPLE_COUNT
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
            ripple.material.opacity = fade * fade * PORTAL_RIPPLE_OPACITY;

        });

        const pulse = 0.5 + Math.sin(elapsedTime * 1.8) * 0.5;
        const coreScale = 0.985 + pulse * 0.025;

        this.coreRing.material.opacity = 0.15 + pulse * 0.05;
        this.coreRing.scale.set(coreScale, coreScale * 0.68, 1);

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

function createSoftRingTexture() {

    const canvas = createTextureCanvas();
    const context = canvas.getContext("2d");
    const center = canvas.width * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        center * 0.56,
        center,
        center,
        center
    );

    gradient.addColorStop(0.48, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.08)");
    gradient.addColorStop(0.73, "rgba(255, 255, 255, 0.86)");
    gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.4)");
    gradient.addColorStop(0.9, "rgba(255, 255, 255, 0.04)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return createCanvasTexture(canvas);

}

function createTextureCanvas() {

    const canvas = document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 256;

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
