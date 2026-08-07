import * as THREE from "three";

export const SEED_EXISTING_THRESHOLD = 0.55;
export const SEED_PRISM_THRESHOLD = 0.45;
export const GROWTH_THRESHOLD = 0.25;
export const MAX_GROWTH_STEPS = 20;
export const BLEND_RADIUS = 3;
export const MIN_COMPONENT_SIZE = 100;
export const CENTER_RETENTION = 0.65;
export const SMOOTHING_PASSES = 4;
export const BOUNDARY_FEATHER_STRENGTH = 0.5;

const adjacencyCache = new Map();

export function getCachedVertexAdjacency(geometry) {

    return adjacencyCache.get(geometry.uuid);

}

/**
 * Refines torso weights through connected mesh topology without changing the
 * imported geometry. Original and prism classifications remain available.
 */
export class TorsoRegionRefiner {

    constructor(model, bodyAnalysis) {

        this.model = model;
        this.bodyAnalysis = bodyAnalysis;
        this.torso = bodyAnalysis.getTorso();
        this.volume = this.torso?.volume;
        this.original = this.torso?.vertexClassification;
        this.prism = this.torso?.prism?.prismClassification;

        this.validateInputs();

    }

    refine() {

        const startTime = this.getTime();
        const originalByMesh = new Map(
            this.original.meshes.map((mesh) => [mesh.meshUUID, mesh])
        );
        const prismByMesh = new Map(
            this.prism.meshes.map((mesh) => [mesh.meshUUID, mesh])
        );
        const meshes = [];
        const debug = { seedMasks: new Map(), grownMasks: new Map(), retainedMasks: new Map() };
        const totals = {
            trustedSeedVertices: 0,
            grownVertices: 0,
            connectedComponents: 0,
            retainedComponents: 0,
            disconnectedVerticesRejected: 0,
            refinedInsideVertices: 0,
            nonZeroWeightTotal: 0,
            nonZeroWeightCount: 0
        };

        this.model.updateWorldMatrix(true, true);

        this.model.traverse((mesh) => {

            if (!mesh.isMesh || !mesh.geometry.attributes.position) return;

            const original = originalByMesh.get(mesh.uuid);
            const prism = prismByMesh.get(mesh.uuid);

            if (!original || !prism) return;

            const result = this.refineMesh(mesh, original.weights, prism.weights);

            meshes.push({
                meshUUID: mesh.uuid,
                vertexCount: result.weights.length,
                weights: result.weights,
                insideCount: result.insideCount
            });
            debug.seedMasks.set(mesh.uuid, result.seedMask);
            debug.grownMasks.set(mesh.uuid, result.grownMask);
            debug.retainedMasks.set(mesh.uuid, result.retainedMask);

            totals.trustedSeedVertices += result.seedCount;
            totals.grownVertices += result.grownCount;
            totals.connectedComponents += result.componentCount;
            totals.retainedComponents += result.retainedComponentCount;
            totals.disconnectedVerticesRejected += result.rejectedCount;
            totals.refinedInsideVertices += result.insideCount;
            totals.nonZeroWeightTotal += result.nonZeroWeightTotal;
            totals.nonZeroWeightCount += result.nonZeroWeightCount;

        });

        return {

            meshes,
            debug,
            statistics: {

                ...totals,
                originalInsideVertices: this.original.statistics.insideVertices,
                averageNonZeroWeight: totals.nonZeroWeightCount > 0
                    ? totals.nonZeroWeightTotal / totals.nonZeroWeightCount
                    : 0,
                refinementTimeMs: this.getTime() - startTime

            }

        };

    }

    refineMesh(mesh, existingWeights, prismWeights) {

        const geometry = mesh.geometry;
        const adjacency = this.getAdjacency(geometry);
        const count = existingWeights.length;
        const seedMask = new Uint8Array(count);
        const boundsMask = this.createBoundsMask(mesh);
        const grownMask = new Uint8Array(count);
        let seedCount = 0;

        for (let index = 0; index < count; index++) {

            if (boundsMask[index] &&
                existingWeights[index] >= SEED_EXISTING_THRESHOLD &&
                prismWeights[index] >= SEED_PRISM_THRESHOLD) {

                seedMask[index] = 1;
                grownMask[index] = 1;
                seedCount++;

            }

        }

        this.growRegion(adjacency, grownMask, boundsMask, existingWeights, prismWeights);

        const grownCount = this.countMask(grownMask);
        const componentResult = this.filterComponents(
            adjacency,
            grownMask,
            seedMask
        );
        const weights = this.createRefinedWeights(
            adjacency,
            componentResult.retainedMask,
            existingWeights,
            prismWeights
        );
        const insideCount = this.countMask(componentResult.retainedMask);
        const nonZero = this.getNonZeroMetrics(weights);

        return {

            weights,
            seedMask,
            grownMask,
            retainedMask: componentResult.retainedMask,
            seedCount,
            grownCount,
            componentCount: componentResult.componentCount,
            retainedComponentCount: componentResult.retainedComponentCount,
            rejectedCount: grownCount - insideCount,
            insideCount,
            ...nonZero

        };

    }

    growRegion(adjacency, grownMask, boundsMask, existing, prism) {

        let frontier = this.getMaskIndexes(grownMask);

        for (let step = 0; step < MAX_GROWTH_STEPS && frontier.length; step++) {

            const next = [];

            frontier.sort((a, b) =>
                Math.max(existing[b], prism[b]) - Math.max(existing[a], prism[a])
            );

            frontier.forEach((index) => {

                adjacency[index].forEach((neighbor) => {

                    if (grownMask[neighbor] || !boundsMask[neighbor]) return;

                    if (existing[neighbor] >= GROWTH_THRESHOLD ||
                        prism[neighbor] >= GROWTH_THRESHOLD) {

                        grownMask[neighbor] = 1;
                        next.push(neighbor);

                    }

                });

            });

            frontier = next;

        }

    }

    filterComponents(adjacency, grownMask, seedMask) {

        const visited = new Uint8Array(grownMask.length);
        const retainedMask = new Uint8Array(grownMask.length);
        let componentCount = 0;
        let retainedComponentCount = 0;

        for (let start = 0; start < grownMask.length; start++) {

            if (!grownMask[start] || visited[start]) continue;

            componentCount++;
            const component = [];
            const queue = [start];
            let containsSeed = false;

            visited[start] = 1;

            while (queue.length) {

                const index = queue.pop();

                component.push(index);
                containsSeed ||= seedMask[index] === 1;

                adjacency[index].forEach((neighbor) => {

                    if (grownMask[neighbor] && !visited[neighbor]) {

                        visited[neighbor] = 1;
                        queue.push(neighbor);

                    }

                });

            }

            if (containsSeed && component.length >= MIN_COMPONENT_SIZE) {

                retainedComponentCount++;
                component.forEach((index) => { retainedMask[index] = 1; });

            }

        }

        return { retainedMask, componentCount, retainedComponentCount };

    }

    createRefinedWeights(adjacency, retainedMask, existing, prism) {

        let current = new Float32Array(existing.length);

        for (let index = 0; index < current.length; index++) {

            if (retainedMask[index]) current[index] = Math.max(existing[index], prism[index]);

        }

        const smoothingPasses = Math.max(SMOOTHING_PASSES, BLEND_RADIUS);

        for (let pass = 0; pass < smoothingPasses; pass++) {

            const next = new Float32Array(current.length);

            for (let index = 0; index < current.length; index++) {

                if (!retainedMask[index]) continue;

                const neighbors = adjacency[index].filter((neighbor) => retainedMask[neighbor]);
                const average = neighbors.length
                    ? neighbors.reduce((sum, neighbor) => sum + current[neighbor], 0) / neighbors.length
                    : current[index];

                next[index] = current[index] * CENTER_RETENTION +
                    average * (1 - CENTER_RETENTION);

            }

            current = next;

        }

        // Feather retained boundary vertices using accepted-neighbor density.
        current.forEach((weight, index) => {

            if (!retainedMask[index]) return;

            const neighbors = adjacency[index];
            const accepted = neighbors.filter((neighbor) => retainedMask[neighbor]).length;
            const density = neighbors.length ? accepted / neighbors.length : 1;

            current[index] = weight * THREE.MathUtils.lerp(
                1,
                density,
                BOUNDARY_FEATHER_STRENGTH
            );

        });

        return current;

    }

    createBoundsMask(mesh) {

        const positions = mesh.geometry.attributes.position;
        const mask = new Uint8Array(positions.count);
        const point = new THREE.Vector3();
        const bounds = this.volume.overallBounds;
        const depth = this.torso.prism.depthBounds;

        for (let index = 0; index < positions.count; index++) {

            point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
            mask[index] = point.y >= bounds.min.y && point.y <= bounds.max.y &&
                point.z >= depth.minZ && point.z <= depth.maxZ ? 1 : 0;

        }

        return mask;

    }

    getAdjacency(geometry) {

        if (adjacencyCache.has(geometry.uuid)) return adjacencyCache.get(geometry.uuid);

        const count = geometry.attributes.position.count;
        const adjacency = Array.from({ length: count }, () => []);
        const addEdge = (a, b) => {

            if (!adjacency[a].includes(b)) adjacency[a].push(b);
            if (!adjacency[b].includes(a)) adjacency[b].push(a);

        };
        const index = geometry.index?.array;

        if (index) {

            for (let offset = 0; offset < index.length; offset += 3) {

                addEdge(index[offset], index[offset + 1]);
                addEdge(index[offset + 1], index[offset + 2]);
                addEdge(index[offset + 2], index[offset]);

            }

        } else {

            const position = geometry.attributes.position;
            const sharedPositions = new Map();

            for (let offset = 0; offset + 2 < count; offset += 3) {

                addEdge(offset, offset + 1);
                addEdge(offset + 1, offset + 2);
                addEdge(offset + 2, offset);

            }

            for (let vertex = 0; vertex < count; vertex++) {

                const key = `${position.getX(vertex)},${position.getY(vertex)},${position.getZ(vertex)}`;
                const shared = sharedPositions.get(key);

                if (shared !== undefined) addEdge(vertex, shared);
                else sharedPositions.set(key, vertex);

            }

        }

        adjacencyCache.set(geometry.uuid, adjacency);

        return adjacency;

    }

    getMaskIndexes(mask) {

        const indexes = [];

        mask.forEach((value, index) => { if (value) indexes.push(index); });

        return indexes;

    }

    countMask(mask) {

        return mask.reduce((sum, value) => sum + value, 0);

    }

    getNonZeroMetrics(weights) {

        let nonZeroWeightTotal = 0;
        let nonZeroWeightCount = 0;

        weights.forEach((weight) => {

            if (weight > 0) {

                nonZeroWeightTotal += weight;
                nonZeroWeightCount++;

            }

        });

        return { nonZeroWeightTotal, nonZeroWeightCount };

    }

    validateInputs() {

        if (!this.model || !this.volume || !this.original?.meshes || !this.prism?.meshes) {

            throw new Error("Torso refinement requires model, volume, original, and prism weights.");

        }

    }

    getTime() {

        return globalThis.performance?.now?.() ?? Date.now();

    }

}
