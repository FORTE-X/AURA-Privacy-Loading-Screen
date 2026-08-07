import * as THREE from "three";

// Coverage controls for the padded elliptical torso cross-sections.
export const TORSO_WIDTH_PADDING_FACTOR = 1.1;
export const TORSO_DEPTH_PADDING_FACTOR = 1.08;
export const VERTICAL_PADDING_SLICES = 2;
export const RADIAL_FALLOFF_START = 0.72;
export const RADIAL_FALLOFF_END = 1;
export const HEIGHT_FALLOFF_START = 0.82;
export const HEIGHT_FALLOFF_END = 1;
export const INTERIOR_ELLIPSE_RADIUS = 0.68;
export const INTERIOR_HEIGHT_MIN = 0.12;
export const INTERIOR_HEIGHT_MAX = 0.88;
export const INTERIOR_WEIGHT_FLOOR = 0.2;

// Retained only to report how padded coverage compares with the prior method.
const BASELINE_HORIZONTAL_FALLOFF_START = 0.65;
const BASELINE_HORIZONTAL_FALLOFF_END = 1;
const BASELINE_DEPTH_FALLOFF_START = 0.65;
const BASELINE_DEPTH_FALLOFF_END = 1;
const BASELINE_HEIGHT_FALLOFF_START = 0.7;
const BASELINE_HEIGHT_FALLOFF_END = 1;

/**
 * Creates compact torso weights without modifying source geometry. Each mesh
 * receives one Float32Array aligned with its position attribute indices.
 */
export class TorsoClassifier {

    constructor(model, bodyAnalysis) {

        this.model = model;
        this.bodyAnalysis = bodyAnalysis;
        this.torso = bodyAnalysis?.getTorso();
        this.volume = this.torso?.volume;

        this.validateInputs();
        this.paddedVerticalBounds = this.createPaddedVerticalBounds();

    }

    classify() {

        this.model.updateWorldMatrix(true, true);

        const baseline = this.collectBaselineMetrics();
        const startTime = this.getTime();
        const meshes = [];
        let totalVertices = 0;
        let insideVertices = 0;
        let nonZeroWeightTotal = 0;
        let nonZeroWeightCount = 0;

        this.model.traverse((child) => {

            if (!child.isMesh || !child.geometry.attributes.position) return;

            const result = this.classifyMesh(child);

            meshes.push(result);
            totalVertices += result.vertexCount;
            insideVertices += result.insideCount;
            nonZeroWeightTotal += result.nonZeroWeightTotal;
            nonZeroWeightCount += result.nonZeroWeightCount;

        });

        return {

            meshes,
            statistics: {

                totalVertices,
                insideVertices,
                averageNonZeroWeight: nonZeroWeightCount > 0
                    ? nonZeroWeightTotal / nonZeroWeightCount
                    : 0,
                classificationTimeMs: this.getTime() - startTime,
                baseline

            }

        };

    }

    collectBaselineMetrics() {

        const startTime = this.getTime();
        let insideVertices = 0;
        let nonZeroWeightTotal = 0;
        let nonZeroWeightCount = 0;

        this.model.traverse((child) => {

            if (!child.isMesh || !child.geometry.attributes.position) return;

            const positions = child.geometry.attributes.position;
            const worldPosition = new THREE.Vector3();

            for (let index = 0; index < positions.count; index++) {

                worldPosition.fromBufferAttribute(positions, index);
                worldPosition.applyMatrix4(child.matrixWorld);

                const result = this.evaluateBaseline(worldPosition);

                if (result.inside) insideVertices++;

                if (result.weight > 0) {

                    nonZeroWeightTotal += result.weight;
                    nonZeroWeightCount++;

                }

            }

        });

        return {

            insideVertices,
            averageNonZeroWeight: nonZeroWeightCount > 0
                ? nonZeroWeightTotal / nonZeroWeightCount
                : 0,
            classificationTimeMs: this.getTime() - startTime

        };

    }

    classifyMesh(mesh) {

        const positions = mesh.geometry.attributes.position;
        const weights = new Float32Array(positions.count);
        const worldPosition = new THREE.Vector3();
        let insideCount = 0;
        let nonZeroWeightTotal = 0;
        let nonZeroWeightCount = 0;

        for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {

            worldPosition.fromBufferAttribute(positions, vertexIndex);
            worldPosition.applyMatrix4(mesh.matrixWorld);

            const result = this.evaluateRefined(worldPosition);

            weights[vertexIndex] = result.weight;

            if (result.inside) insideCount++;

            if (result.weight > 0) {

                nonZeroWeightTotal += result.weight;
                nonZeroWeightCount++;

            }

        }

        return {

            meshUUID: mesh.uuid,
            vertexCount: positions.count,
            weights,
            insideCount,
            nonZeroWeightTotal,
            nonZeroWeightCount

        };

    }

    evaluateRefined(worldPosition) {

        const normalizedHeight = this.getNormalizedHeight(
            worldPosition.y,
            this.paddedVerticalBounds
        );

        if (normalizedHeight < 0 || normalizedHeight > 1) {

            return { inside: false, weight: 0 };

        }

        const slice = this.findNearestSlice(worldPosition.y);
        const normalizedRadius = this.getEllipticalDistance(
            worldPosition,
            slice,
            TORSO_WIDTH_PADDING_FACTOR,
            TORSO_DEPTH_PADDING_FACTOR
        );

        if (normalizedRadius > 1) return { inside: false, weight: 0 };

        const heightDistance = Math.abs(normalizedHeight - 0.5) * 2;
        let weight = this.smoothFalloff(
            normalizedRadius,
            RADIAL_FALLOFF_START,
            RADIAL_FALLOFF_END
        ) * this.smoothFalloff(
            heightDistance,
            HEIGHT_FALLOFF_START,
            HEIGHT_FALLOFF_END
        );

        const isCentralInterior =
            normalizedRadius <= INTERIOR_ELLIPSE_RADIUS &&
            normalizedHeight >= INTERIOR_HEIGHT_MIN &&
            normalizedHeight <= INTERIOR_HEIGHT_MAX;

        if (isCentralInterior) {

            weight = Math.max(weight, INTERIOR_WEIGHT_FLOOR);

        }

        return { inside: true, weight };

    }

    evaluateBaseline(worldPosition) {

        const normalizedHeight = this.getNormalizedHeight(
            worldPosition.y,
            this.volume.overallBounds
        );

        if (normalizedHeight < 0 || normalizedHeight > 1) {

            return { inside: false, weight: 0 };

        }

        const slice = this.findNearestSlice(worldPosition.y);
        const horizontalDistance = Math.abs(
            worldPosition.x - slice.center.x
        ) / (slice.width / 2);
        const depthDistance = Math.abs(
            worldPosition.z - slice.center.z
        ) / (slice.depth / 2);

        if (horizontalDistance > 1 || depthDistance > 1) {

            return { inside: false, weight: 0 };

        }

        const heightDistance = Math.abs(normalizedHeight - 0.5) * 2;

        return {

            inside: true,
            weight: this.smoothFalloff(
                horizontalDistance,
                BASELINE_HORIZONTAL_FALLOFF_START,
                BASELINE_HORIZONTAL_FALLOFF_END
            ) * this.smoothFalloff(
                depthDistance,
                BASELINE_DEPTH_FALLOFF_START,
                BASELINE_DEPTH_FALLOFF_END
            ) * this.smoothFalloff(
                heightDistance,
                BASELINE_HEIGHT_FALLOFF_START,
                BASELINE_HEIGHT_FALLOFF_END
            )

        };

    }

    getEllipticalDistance(position, slice, widthPadding, depthPadding) {

        const halfWidth = slice.width * widthPadding / 2;
        const halfDepth = slice.depth * depthPadding / 2;
        const normalizedX = (position.x - slice.center.x) / halfWidth;
        const normalizedZ = (position.z - slice.center.z) / halfDepth;

        return Math.sqrt(
            normalizedX ** 2 + normalizedZ ** 2
        );

    }

    createPaddedVerticalBounds() {

        const metadata = this.bodyAnalysis.getMetadata();
        const padding = metadata.sliceHeight * VERTICAL_PADDING_SLICES;
        const bounds = this.volume.overallBounds;

        return {

            minY: bounds.min.y - padding,
            maxY: bounds.max.y + padding

        };

    }

    smoothFalloff(distance, start, end) {

        return 1 - THREE.MathUtils.smoothstep(distance, start, end);

    }

    findNearestSlice(y) {

        const slices = this.volume.slices;
        let low = 0;
        let high = slices.length - 1;

        while (low <= high) {

            const middle = Math.floor((low + high) / 2);
            const middleY = slices[middle].center.y;

            if (middleY < y) low = middle + 1;
            else if (middleY > y) high = middle - 1;
            else return slices[middle];

        }

        const upper = slices[Math.min(low, slices.length - 1)];
        const lower = slices[Math.max(high, 0)];

        return Math.abs(y - lower.center.y) <=
            Math.abs(upper.center.y - y)
            ? lower
            : upper;

    }

    getNormalizedHeight(y, bounds) {

        const minY = bounds.minY ?? bounds.min.y;
        const maxY = bounds.maxY ?? bounds.max.y;

        return (y - minY) / (maxY - minY);

    }

    validateInputs() {

        if (!this.model) {

            throw new Error("Torso classification requires an imported model.");

        }

        if (!this.torso) {

            throw new Error("Torso classification requires torso inference.");

        }

        if (!this.volume) {

            throw new Error("Torso classification requires a torso volume.");

        }

        if (!Array.isArray(this.volume.slices) ||
            this.volume.slices.length === 0) {

            throw new Error("Torso classification requires non-empty slices.");

        }

        const hasInvalidSlice = this.volume.slices.some((slice) =>
            !Number.isFinite(slice.width) ||
            !Number.isFinite(slice.depth) ||
            slice.width <= 0 ||
            slice.depth <= 0 ||
            !slice.center?.isVector3
        );

        if (hasInvalidSlice) {

            throw new Error("Torso classification received invalid slice data.");

        }

        const bounds = this.volume.overallBounds;

        if (!bounds?.isBox3 || bounds.max.y <= bounds.min.y) {

            throw new Error("Torso classification received invalid volume bounds.");

        }

    }

    getTime() {

        return globalThis.performance?.now?.() ?? Date.now();

    }

}
