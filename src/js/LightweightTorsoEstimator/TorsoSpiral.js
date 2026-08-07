import * as THREE from "three";

export const SPIRAL_TURNS = 5;
export const SPIRAL_SEGMENTS = 320;
export const SPIRAL_SURFACE_CLEARANCE = 0.006;
export const SPIRAL_COLOR = 0xffd0e5;

export class TorsoSpiral {

    constructor(estimation) {

        if (!estimation?.bounds || estimation.bounds.isEmpty()) {

            throw new Error("A valid torso estimation is required for the spiral.");

        }

        this.estimation = estimation;
        this.geometry = createSpiralGeometry(estimation);
        this.material = new THREE.LineBasicMaterial({
            color: SPIRAL_COLOR,
            transparent: true,
            opacity: 0.95,
            depthTest: false
        });
        this.line = new THREE.Line(this.geometry, this.material);
        this.line.name = "Torso Surface Spiral";
        this.line.renderOrder = 1001;

    }

    get object3D() {

        return this.line;

    }

    dispose() {

        this.line.removeFromParent();
        this.geometry.dispose();
        this.material.dispose();

    }

}

function createSpiralGeometry(estimation) {

    const bounds = estimation.bounds;
    const boundsCenter = bounds.getCenter(new THREE.Vector3());
    const boundsSize = bounds.getSize(new THREE.Vector3());
    const usableSlices = (estimation.slices ?? [])
        .filter((slice) => Number.isFinite(slice.width) &&
            Number.isFinite(slice.depth))
        .sort((a, b) => a.normalizedHeight - b.normalizedHeight);
    const bodyMinY = estimation.bodyBounds?.min.y ?? bounds.min.y;
    const bodyHeight = estimation.bodyBounds
        ? estimation.bodyBounds.max.y - estimation.bodyBounds.min.y
        : boundsSize.y;
    const positions = new Float32Array((SPIRAL_SEGMENTS + 1) * 3);

    for (let index = 0; index <= SPIRAL_SEGMENTS; index++) {

        const progress = index / SPIRAL_SEGMENTS;
        const y = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, progress);
        const normalizedHeight = bodyHeight > Number.EPSILON
            ? (y - bodyMinY) / bodyHeight
            : progress;
        const profile = interpolateProfile(
            usableSlices,
            normalizedHeight,
            boundsCenter,
            boundsSize
        );
        const angle = progress * SPIRAL_TURNS * Math.PI * 2;
        const availableRadiusX = Math.max(
            0,
            Math.min(
                bounds.max.x - profile.centerX,
                profile.centerX - bounds.min.x
            ) * 0.98
        );
        const availableRadiusZ = Math.max(
            0,
            Math.min(
                bounds.max.z - profile.centerZ,
                profile.centerZ - bounds.min.z
            ) * 0.98
        );
        const radiusX = Math.min(
            profile.width * 0.5 + SPIRAL_SURFACE_CLEARANCE,
            availableRadiusX
        );
        const radiusZ = Math.min(
            profile.depth * 0.5 + SPIRAL_SURFACE_CLEARANCE,
            availableRadiusZ
        );
        const offset = index * 3;

        positions[offset] = profile.centerX + Math.cos(angle) * radiusX;
        positions[offset + 1] = y;
        positions[offset + 2] = profile.centerZ + Math.sin(angle) * radiusZ;

    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();

    return geometry;

}

function interpolateProfile(slices, normalizedHeight, fallbackCenter, fallbackSize) {

    if (slices.length === 0) {

        return {
            centerX: fallbackCenter.x,
            centerZ: fallbackCenter.z,
            width: fallbackSize.x * 0.94,
            depth: fallbackSize.z * 0.94
        };

    }

    if (normalizedHeight <= slices[0].normalizedHeight) {

        return slices[0];

    }

    const last = slices[slices.length - 1];

    if (normalizedHeight >= last.normalizedHeight) return last;

    for (let index = 1; index < slices.length; index++) {

        const upper = slices[index];

        if (normalizedHeight > upper.normalizedHeight) continue;

        const lower = slices[index - 1];
        const range = upper.normalizedHeight - lower.normalizedHeight;
        const blend = range > Number.EPSILON
            ? (normalizedHeight - lower.normalizedHeight) / range
            : 0;

        return {
            centerX: THREE.MathUtils.lerp(lower.centerX, upper.centerX, blend),
            centerZ: THREE.MathUtils.lerp(lower.centerZ, upper.centerZ, blend),
            width: THREE.MathUtils.lerp(lower.width, upper.width, blend),
            depth: THREE.MathUtils.lerp(lower.depth, upper.depth, blend)
        };

    }

    return last;

}
