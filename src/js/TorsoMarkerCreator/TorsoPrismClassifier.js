import * as THREE from "three";

export const UPPER_ANCHOR_SLICE_OFFSET = 2;
export const CORE_UPPER_WIDTH_SCALE = 1.0;
export const EXPANDED_UPPER_WIDTH_SCALE = 1.3;
export const MAX_EXPANDED_UPPER_WIDTH_SCALE = 1.35;
export const LATERAL_BLEND_SOFTNESS = 0.5;
// Legacy alias retained for callers that used the original prism constant.
export const UPPER_TRIANGLE_WIDTH_FACTOR = CORE_UPPER_WIDTH_SCALE;
export const LOWER_POINT_HEIGHT_OFFSET = 0;
export const Z_DEPTH_PADDING = 1.1;
export const Z_DEPTH_PADDING_FACTOR = Z_DEPTH_PADDING;
export const PRISM_EDGE_PADDING = 0.06;
export const PRISM_EDGE_SOFTNESS = 0.15;
export const PRISM_DEPTH_SOFTNESS = 0.12;
export const PRISM_BLEND_MODE = "max";
export const PRISM_BLEND_STRENGTH = 0.65;

const PREVIOUS_UPPER_WIDTH_SCALE = 0.95;

/**
 * Adds experimental front-view triangular-prism coverage to the existing
 * compact torso weights. It never changes imported mesh geometry.
 */
export class TorsoPrismClassifier {

    constructor(model, bodyAnalysis) {

        this.model = model;
        this.bodyAnalysis = bodyAnalysis;
        this.torso = bodyAnalysis.getTorso();
        this.volume = this.torso?.volume;
        this.classification = this.torso?.vertexClassification;

        this.validateInputs();
        this.coreTriangle = this.createTriangle(CORE_UPPER_WIDTH_SCALE);
        this.expandedTriangle = this.createTriangle(
            Math.min(
                EXPANDED_UPPER_WIDTH_SCALE,
                MAX_EXPANDED_UPPER_WIDTH_SCALE
            )
        );
        // Retain the original public anchors field as the core triangle.
        this.anchors = this.coreTriangle;
        this.depthBounds = this.createDepthBounds();

    }

    classify() {

        const startTime = this.getTime();
        const weightsByMesh = new Map(
            this.classification.meshes.map((mesh) => [
                mesh.meshUUID,
                mesh
            ])
        );
        let verticesAdded = 0;
        let insideAfter = 0;
        let nonZeroWeightTotal = 0;
        let nonZeroWeightCount = 0;
        let widenedBlendVertices = 0;
        const prismMeshes = [];

        this.model.updateWorldMatrix(true, true);

        this.model.traverse((child) => {

            if (!child.isMesh || !child.geometry.attributes.position) return;

            const meshClassification = weightsByMesh.get(child.uuid);

            if (!meshClassification) return;

            const positions = child.geometry.attributes.position;
            const worldPosition = new THREE.Vector3();
            const prismWeights = new Float32Array(positions.count);
            let prismInsideCount = 0;

            for (let index = 0; index < positions.count; index++) {

                worldPosition.fromBufferAttribute(positions, index);
                worldPosition.applyMatrix4(child.matrixWorld);

                const existingWeight = meshClassification.weights[index];
                const prism = this.getPrismWeight(worldPosition);
                const combinedWeight = this.blendWeight(
                    existingWeight,
                    prism.weight
                );

                prismWeights[index] = prism.weight;

                if (prism.inside) prismInsideCount++;

                if (prism.inside && existingWeight === 0 &&
                    combinedWeight > 0) {

                    verticesAdded++;

                }

                if (prism.inWidenedBlendZone && existingWeight === 0 &&
                    combinedWeight > 0) {

                    widenedBlendVertices++;

                }

                if (existingWeight > 0 || prism.inside) insideAfter++;

                if (combinedWeight > 0) {

                    nonZeroWeightTotal += combinedWeight;
                    nonZeroWeightCount++;

                }

            }

            prismMeshes.push({

                meshUUID: child.uuid,
                vertexCount: positions.count,
                weights: prismWeights,
                insideCount: prismInsideCount

            });

        });

        const statistics = this.classification.statistics;
        const insideVerticesBefore = statistics.insideVertices;

        const combinedAverageWeight = nonZeroWeightCount > 0
            ? nonZeroWeightTotal / nonZeroWeightCount
            : 0;
        statistics.prism = {

            verticesAdded,
            widenedBlendVertices,
            insideVerticesBefore,
            insideVerticesAfter: insideAfter,
            averageNonZeroWeight: combinedAverageWeight,
            classificationTimeMs: this.getTime() - startTime,
            previousUpperWidth: this.getTriangleWidth(this.coreTriangle) *
                PREVIOUS_UPPER_WIDTH_SCALE / CORE_UPPER_WIDTH_SCALE,
            coreUpperWidth: this.getTriangleWidth(this.coreTriangle),
            expandedUpperWidth: this.getTriangleWidth(this.expandedTriangle)

        };

        return {

            anchors: this.anchors,
            coreTriangle: this.coreTriangle,
            expandedTriangle: this.expandedTriangle,
            depthBounds: this.depthBounds,
            prismClassification: {

                meshes: prismMeshes,
                statistics: {

                    insideVertices: prismMeshes.reduce(
                        (sum, mesh) => sum + mesh.insideCount,
                        0
                    )

                }

            },
            statistics: statistics.prism

        };

    }

    createTriangle(widthScale) {

        const slices = this.volume.slices;
        const upperIndex = Math.max(
            0,
            slices.length - 1 - UPPER_ANCHOR_SLICE_OFFSET
        );
        const upperSlice = slices[upperIndex];
        const lowerSlice = slices[0];
        const halfWidth = upperSlice.width * widthScale / 2;

        return {

            upperLeft: new THREE.Vector3(
                upperSlice.center.x - halfWidth,
                upperSlice.center.y,
                upperSlice.center.z
            ),
            upperRight: new THREE.Vector3(
                upperSlice.center.x + halfWidth,
                upperSlice.center.y,
                upperSlice.center.z
            ),
            lowerCenter: new THREE.Vector3(
                lowerSlice.center.x,
                lowerSlice.center.y + LOWER_POINT_HEIGHT_OFFSET,
                lowerSlice.center.z
            )

        };

    }

    createDepthBounds() {

        const bounds = this.volume.overallBounds;
        const centerZ = (bounds.min.z + bounds.max.z) / 2;
        const halfDepth = (bounds.max.z - bounds.min.z) *
            Z_DEPTH_PADDING / 2;

        return {

            minZ: centerZ - halfDepth,
            maxZ: centerZ + halfDepth

        };

    }

    getPrismWeight(position) {

        const coreCoordinate = this.getMinimumBarycentricCoordinate(
            position,
            this.coreTriangle
        );
        const expandedCoordinate = this.getMinimumBarycentricCoordinate(
            position,
            this.expandedTriangle
        );
        const insideCore = coreCoordinate >= 0;
        const insideExpanded = expandedCoordinate >= 0;
        const depthDistance = this.getNormalizedDepthDistance(position.z);

        if (!insideExpanded || depthDistance > 1) {

            return {

                inside: false,
                inWidenedBlendZone: false,
                weight: 0

            };

        }

        const triangleWeight = insideCore
            ? 1
            : this.getLateralBlendWeight(
                coreCoordinate,
                expandedCoordinate
            );
        const depthWeight = 1 - THREE.MathUtils.smoothstep(
            depthDistance,
            1 - PRISM_DEPTH_SOFTNESS,
            1
        );

        return {

            inside: true,
            inWidenedBlendZone: !insideCore,
            weight: triangleWeight * depthWeight

        };

    }

    getMinimumBarycentricCoordinate(position, triangle) {

        const barycentric = this.getBarycentricCoordinates(position, triangle);

        return Math.min(barycentric.u, barycentric.v, barycentric.w);

    }

    getBarycentricCoordinates(position, triangle) {

        const { upperLeft, upperRight, lowerCenter } = triangle;
        const denominator =
            (upperRight.y - lowerCenter.y) *
            (upperLeft.x - lowerCenter.x) +
            (lowerCenter.x - upperRight.x) *
            (upperLeft.y - lowerCenter.y);
        const u = (
            (upperRight.y - lowerCenter.y) *
            (position.x - lowerCenter.x) +
            (lowerCenter.x - upperRight.x) *
            (position.y - lowerCenter.y)
        ) / denominator;
        const v = (
            (lowerCenter.y - upperLeft.y) *
            (position.x - lowerCenter.x) +
            (upperLeft.x - lowerCenter.x) *
            (position.y - lowerCenter.y)
        ) / denominator;

        return { u, v, w: 1 - u - v };

    }

    getNormalizedDepthDistance(z) {

        const centerZ = (this.depthBounds.minZ + this.depthBounds.maxZ) / 2;
        const halfDepth = (this.depthBounds.maxZ - this.depthBounds.minZ) / 2;

        return Math.abs(z - centerZ) / halfDepth;

    }

    getLateralBlendWeight(coreCoordinate, expandedCoordinate) {

        const distanceFromCore = Math.max(0, -coreCoordinate);
        const distanceFromExpandedEdge = Math.max(0, expandedCoordinate);
        const blendPosition = distanceFromExpandedEdge /
            (distanceFromCore + distanceFromExpandedEdge + Number.EPSILON);

        return THREE.MathUtils.smoothstep(
            blendPosition,
            1 - LATERAL_BLEND_SOFTNESS,
            1
        );

    }

    getTriangleWidth(triangle) {

        return Math.abs(triangle.upperRight.x - triangle.upperLeft.x);

    }

    blendWeight(existingWeight, prismWeight) {

        switch (PRISM_BLEND_MODE) {

            case "multiply":
                return existingWeight * prismWeight;

            case "weighted":
                return THREE.MathUtils.lerp(
                    existingWeight,
                    prismWeight,
                    PRISM_BLEND_STRENGTH
                );

            case "max":
            default:
                return Math.max(existingWeight, prismWeight);

        }

    }

    validateInputs() {

        if (!this.model) {

            throw new Error("Prism classification requires an imported model.");

        }

        if (!this.torso || !this.volume) {

            throw new Error("Prism classification requires torso volume data.");

        }

        if (!this.classification?.meshes) {

            throw new Error("Prism classification requires torso weights.");

        }

        if (this.volume.slices.length < 2) {

            throw new Error("Prism classification requires at least two torso slices.");

        }

        const upperSlice = this.volume.slices[
            Math.max(0, this.volume.slices.length - 1 -
                UPPER_ANCHOR_SLICE_OFFSET)
        ];
        const lowerSlice = this.volume.slices[0];

        if (upperSlice.center.y === lowerSlice.center.y) {

            throw new Error("Prism classification requires vertically distinct slices.");

        }

    }

    getTime() {

        return globalThis.performance?.now?.() ?? Date.now();

    }

}
