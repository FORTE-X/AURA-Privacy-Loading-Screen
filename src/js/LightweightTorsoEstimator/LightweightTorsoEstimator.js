import * as THREE from "three";
import { excludeArmsFromSlice } from "./ArmExcluder.js";

export const TORSO_SLICE_COUNT = 15;
export const TORSO_SEARCH_BOTTOM = 0.42;
export const TORSO_SEARCH_TOP = 0.86;
export const TORSO_BOTTOM = 0.45;
export const TORSO_TOP = 0.82;
export const TORSO_WIDTH_MARGIN = 0.08;
export const TORSO_DEPTH_MARGIN = 0.1;
export const TORSO_LOWER_EXTENSION = 0.1;

const LOWER_SAMPLE_QUANTILE = 0.08;
const UPPER_SAMPLE_QUANTILE = 0.92;

/**
 * Estimates an upright model's torso with two lightweight vertex passes.
 * Results are expressed in the supplied coordinate space, normally the
 * imported model container.
 */
export function estimateTorsoBounds(model, coordinateSpace = model.parent) {

    if (!model?.isObject3D) {

        throw new Error("Torso estimation requires an imported THREE.Object3D.");

    }

    model.updateWorldMatrix(true, true);
    coordinateSpace?.updateWorldMatrix(true, false);

    const toCoordinateSpace = coordinateSpace
        ? coordinateSpace.matrixWorld.clone().invert()
        : new THREE.Matrix4();
    const point = new THREE.Vector3();
    const bodyBounds = new THREE.Box3();
    let vertexCount = 0;

    visitVertices(model, (mesh, positions, index) => {

        point.fromBufferAttribute(positions, index)
            .applyMatrix4(mesh.matrixWorld)
            .applyMatrix4(toCoordinateSpace);
        bodyBounds.expandByPoint(point);
        vertexCount++;

    });

    if (vertexCount === 0 || bodyBounds.isEmpty()) {

        throw new Error("The imported model has no usable mesh vertices.");

    }

    const bodySize = bodyBounds.getSize(new THREE.Vector3());

    if (!Number.isFinite(bodySize.y) || bodySize.y <= Number.EPSILON) {

        throw new Error("The imported model has an invalid height.");

    }

    const searchBottomY = bodyBounds.min.y + bodySize.y * TORSO_SEARCH_BOTTOM;
    const searchTopY = bodyBounds.min.y + bodySize.y * TORSO_SEARCH_TOP;
    const sliceHeight = (searchTopY - searchBottomY) / TORSO_SLICE_COUNT;
    const slices = Array.from({ length: TORSO_SLICE_COUNT }, () => ({
        x: [],
        z: []
    }));

    visitVertices(model, (mesh, positions, index) => {

        point.fromBufferAttribute(positions, index)
            .applyMatrix4(mesh.matrixWorld)
            .applyMatrix4(toCoordinateSpace);

        if (point.y < searchBottomY || point.y > searchTopY) return;

        const sliceIndex = Math.min(
            TORSO_SLICE_COUNT - 1,
            Math.floor((point.y - searchBottomY) / sliceHeight)
        );

        slices[sliceIndex].x.push(point.x);
        slices[sliceIndex].z.push(point.z);

    });

    const measurements = slices.map((slice, index) => {

        if (slice.x.length < 4) return null;

        const bodyCenterX = (bodyBounds.min.x + bodyBounds.max.x) * 0.5;
        const filtered = excludeArmsFromSlice(
            slice.x,
            slice.z,
            bodyCenterX,
            bodySize.y
        );

        if (filtered.x.length < 4) return null;

        filtered.x.sort((a, b) => a - b);
        filtered.z.sort((a, b) => a - b);

        const minX = quantile(filtered.x, LOWER_SAMPLE_QUANTILE);
        const maxX = quantile(filtered.x, UPPER_SAMPLE_QUANTILE);
        const minZ = quantile(filtered.z, LOWER_SAMPLE_QUANTILE);
        const maxZ = quantile(filtered.z, UPPER_SAMPLE_QUANTILE);

        return {
            index,
            normalizedHeight: TORSO_SEARCH_BOTTOM +
                ((index + 0.5) / TORSO_SLICE_COUNT) *
                (TORSO_SEARCH_TOP - TORSO_SEARCH_BOTTOM),
            minX,
            maxX,
            minZ,
            maxZ,
            width: maxX - minX,
            depth: maxZ - minZ,
            centerX: (minX + maxX) * 0.5,
            centerZ: (minZ + maxZ) * 0.5,
            sampleCount: filtered.x.length,
            excludedArmSamples: filtered.excludedCount
        };

    }).filter(Boolean);

    const torsoSlices = measurements.filter((slice) =>
        slice.normalizedHeight >= TORSO_BOTTOM &&
        slice.normalizedHeight <= TORSO_TOP
    );

    if (torsoSlices.length === 0) {

        return createFallback(bodyBounds, bodySize, vertexCount);

    }

    const hipAndChestSlices = torsoSlices.filter((slice) =>
        (slice.normalizedHeight >= 0.45 && slice.normalizedHeight <= 0.60) ||
        (slice.normalizedHeight >= 0.64 && slice.normalizedHeight <= 0.78)
    );
    const sizingSlices = hipAndChestSlices.length
        ? hipAndChestSlices
        : torsoSlices;
    const widest = sizingSlices.reduce((best, slice) =>
        slice.width > best.width ? slice : best
    );
    const deepest = sizingSlices.reduce((best, slice) =>
        slice.depth > best.depth ? slice : best
    );
    const centerX = median(torsoSlices.map((slice) => slice.centerX));
    const centerZ = median(torsoSlices.map((slice) => slice.centerZ));
    const width = widest.width * (1 + TORSO_WIDTH_MARGIN * 2);
    const depth = deepest.depth * (1 + TORSO_DEPTH_MARGIN * 2);
    const originalBottomY = bodyBounds.min.y + bodySize.y * TORSO_BOTTOM;
    const topY = bodyBounds.min.y + bodySize.y * TORSO_TOP;
    const bottomY = originalBottomY -
        (topY - originalBottomY) * TORSO_LOWER_EXTENSION;
    const bounds = new THREE.Box3(
        new THREE.Vector3(centerX - width * 0.5, bottomY, centerZ - depth * 0.5),
        new THREE.Vector3(centerX + width * 0.5, topY, centerZ + depth * 0.5)
    );
    const excludedArmSamples = measurements.reduce(
        (total, slice) => total + slice.excludedArmSamples,
        0
    );

    return {
        bounds,
        bodyBounds,
        slices: measurements,
        sliceCount: TORSO_SLICE_COUNT,
        excludedArmSamples,
        vertexCount,
        method: "15-slice central-component torso estimate"
    };

}

function visitVertices(model, visitor) {

    model.traverse((mesh) => {

        if (!mesh.isMesh) return;

        const positions = mesh.geometry?.getAttribute("position");

        if (!positions) return;

        for (let index = 0; index < positions.count; index++) {

            visitor(mesh, positions, index);

        }

    });

}

function quantile(sortedValues, fraction) {

    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.floor((sortedValues.length - 1) * fraction))
    );

    return sortedValues[index];

}

function median(values) {

    values.sort((a, b) => a - b);

    return quantile(values, 0.5);

}

function createFallback(bodyBounds, bodySize, vertexCount) {

    const center = bodyBounds.getCenter(new THREE.Vector3());
    const originalBottomY = bodyBounds.min.y + bodySize.y * TORSO_BOTTOM;
    const topY = bodyBounds.min.y + bodySize.y * TORSO_TOP;
    const bottomY = originalBottomY -
        (topY - originalBottomY) * TORSO_LOWER_EXTENSION;
    const width = bodySize.x * 0.55;
    const depth = bodySize.z * 0.65;

    return {
        bounds: new THREE.Box3(
            new THREE.Vector3(center.x - width * 0.5, bottomY, center.z - depth * 0.5),
            new THREE.Vector3(center.x + width * 0.5, topY, center.z + depth * 0.5)
        ),
        bodyBounds,
        slices: [],
        sliceCount: TORSO_SLICE_COUNT,
        excludedArmSamples: 0,
        vertexCount,
        method: "proportional fallback torso estimate"
    };

}
