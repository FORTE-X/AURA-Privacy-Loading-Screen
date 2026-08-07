import * as THREE from "three";
import { getCachedVertexAdjacency } from "./TorsoRegionRefiner.js";

export const VERTICAL_GAP_MAX_SLICES = 3;
export const VERTICAL_SUPPORT_THRESHOLD = 0.35;
export const MIN_SLICE_VERTEX_COUNT = 20;
export const VERTICAL_INTERPOLATION_SOFTNESS = 0.5;
export const MIN_VERTICAL_RUN_LENGTH = 3;
export const VERTICAL_BOUNDARY_FEATHER_SLICES = 1;
export const VOLUME_EXPANSION_FACTOR = 1.2;
export const EXPANSION_BLEND_STRENGTH = 0.8;
export const EXPANSION_EDGE_SOFTNESS = 0.25;
export const EXPANSION_ADJACENCY_STEPS = 2;

/**
 * Builds tapered vertical torso profiles from refined connected weights, then
 * expands only that analytical volume and never the imported geometry.
 */
export class TorsoVolumeExpander {

    constructor(model, bodyAnalysis) {

        this.model = model;
        this.bodyAnalysis = bodyAnalysis;
        this.torso = bodyAnalysis.getTorso();
        this.volume = this.torso?.volume;
        this.refined = this.torso?.refinedVertexClassification;

        if (!model || !this.volume || !this.refined) {

            throw new Error("Volume expansion requires model, torso volume, and refined weights.");

        }

    }

    expand() {

        const start = this.now();
        const samples = this.collectSliceSamples();
        const synchronized = this.synchronize(samples);
        const expanded = this.expandProfiles(synchronized.profiles);
        const classification = this.classifyExpanded(expanded);

        return {

            synchronizedVolume: synchronized,
            expandedVolume: expanded,
            expandedVertexClassification: classification,
            statistics: {

                validSlicesBeforeSynchronization: samples.filter((sample) => sample.valid).length,
                verticalGapsDetected: synchronized.gapsDetected,
                gapsFilled: synchronized.gapsFilled,
                isolatedSlicesRejected: synchronized.isolatedSlicesRejected,
                synchronizedSliceCount: synchronized.profiles.length,
                originalSynchronizedVolumeBounds: synchronized.bounds,
                expandedVolumeBounds: expanded.bounds,
                originalRefinedInsideVertices: this.refined.statistics.refinedInsideVertices,
                expandedInsideVertices: classification.statistics.insideVertices,
                newlyAddedVertices: classification.statistics.newlyAddedVertices,
                averageFinalNonZeroWeight: classification.statistics.averageNonZeroWeight,
                processingTimeMs: this.now() - start

            }

        };

    }

    collectSliceSamples() {

        const profiles = this.volume.slices.map((slice) => ({

            sliceIndex: slice.sliceIndex,
            yMin: slice.minY,
            yMax: slice.maxY,
            values: [],
            source: "original"

        }));
        const refinedByMesh = new Map(this.refined.meshes.map((mesh) => [mesh.meshUUID, mesh]));

        this.model.updateWorldMatrix(true, true);
        this.model.traverse((mesh) => {

            if (!mesh.isMesh || !mesh.geometry.attributes.position) return;

            const refined = refinedByMesh.get(mesh.uuid);

            if (!refined) return;

            const positions = mesh.geometry.attributes.position;
            const point = new THREE.Vector3();

            for (let index = 0; index < positions.count; index++) {

                const weight = refined.weights[index];

                if (weight < VERTICAL_SUPPORT_THRESHOLD) continue;

                point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
                const slice = profiles[this.findNearestProfile(point.y, profiles)];

                slice.values.push({ x: point.x, z: point.z, weight });

            }

        });

        return profiles.map((profile) => this.measureProfile(profile));

    }

    measureProfile(profile) {

        const count = profile.values.length;

        if (count === 0) return { ...profile, valid: false };

        const xs = profile.values.map((value) => value.x);
        const zs = profile.values.map((value) => value.z);
        const weights = profile.values.map((value) => value.weight);
        const averageWeight = weights.reduce((sum, value) => sum + value, 0) / count;

        return {

            sliceIndex: profile.sliceIndex,
            yMin: profile.yMin,
            yMax: profile.yMax,
            centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
            centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
            halfWidth: (Math.max(...xs) - Math.min(...xs)) / 2,
            halfDepth: (Math.max(...zs) - Math.min(...zs)) / 2,
            acceptedVertexCount: count,
            averageWeight,
            maximumWeight: Math.max(...weights),
            source: "original",
            valid: count >= MIN_SLICE_VERTEX_COUNT && averageWeight >= VERTICAL_SUPPORT_THRESHOLD

        };

    }

    synchronize(samples) {

        const profiles = samples.map((sample) => ({ ...sample }));
        let gapsDetected = 0;
        let gapsFilled = 0;

        for (let start = 0; start < profiles.length; start++) {

            if (profiles[start].valid) continue;

            let end = start;

            while (end < profiles.length && !profiles[end].valid) end++;

            const gapLength = end - start;
            const lower = profiles[start - 1];
            const upper = profiles[end];

            if (lower?.valid && upper?.valid && gapLength <= VERTICAL_GAP_MAX_SLICES) {

                gapsDetected++;

                for (let index = start; index < end; index++) {

                    const t = (index - start + 1) / (gapLength + 1);

                    profiles[index] = this.interpolateProfile(lower, upper, profiles[index], t);
                    gapsFilled++;

                }

            }

            start = end;

        }

        const retained = this.retainCenterRun(profiles);

        return {

            profiles: retained.profiles,
            bounds: this.createBounds(retained.profiles),
            gapsDetected,
            gapsFilled,
            isolatedSlicesRejected: retained.rejected

        };

    }

    interpolateProfile(lower, upper, target, t) {

        const smoothT = THREE.MathUtils.smoothstep(
            t,
            VERTICAL_INTERPOLATION_SOFTNESS / 2,
            1 - VERTICAL_INTERPOLATION_SOFTNESS / 2
        );

        return {

            sliceIndex: target.sliceIndex,
            yMin: target.yMin,
            yMax: target.yMax,
            centerX: THREE.MathUtils.lerp(lower.centerX, upper.centerX, smoothT),
            centerZ: THREE.MathUtils.lerp(lower.centerZ, upper.centerZ, smoothT),
            halfWidth: THREE.MathUtils.lerp(lower.halfWidth, upper.halfWidth, smoothT),
            halfDepth: THREE.MathUtils.lerp(lower.halfDepth, upper.halfDepth, smoothT),
            acceptedVertexCount: 0,
            averageWeight: THREE.MathUtils.lerp(lower.averageWeight, upper.averageWeight, smoothT),
            maximumWeight: THREE.MathUtils.lerp(lower.maximumWeight, upper.maximumWeight, smoothT),
            source: "interpolated",
            valid: true

        };

    }

    retainCenterRun(profiles) {

        const runs = [];
        let start = null;

        profiles.forEach((profile, index) => {

            if (profile.valid && start === null) start = index;

            if (start !== null && (!profile.valid || index === profiles.length - 1)) {

                const end = profile.valid ? index : index - 1;

                if (end - start + 1 >= MIN_VERTICAL_RUN_LENGTH) runs.push([start, end]);

                start = null;

            }

        });

        const centerSlice = this.torso.centerSlice;
        const preferred = runs.find(([start, end]) =>
            profiles.slice(start, end + 1).some((profile) => profile.sliceIndex === centerSlice)
        ) ?? runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];

        const retained = preferred ? profiles.slice(preferred[0], preferred[1] + 1) : [];

        return { profiles: retained, rejected: profiles.length - retained.length };

    }

    expandProfiles(profiles) {

        const safeBounds = this.bodyAnalysis.getMetadata().modelBounds;
        const expanded = profiles.map((profile, index) => ({

            ...profile,
            yMin: index === 0
                ? Math.max(safeBounds.min.y, profile.yMin - this.boundaryPadding(profile))
                : profile.yMin,
            yMax: index === profiles.length - 1
                ? Math.min(safeBounds.max.y, profile.yMax + this.boundaryPadding(profile))
                : profile.yMax,
            halfWidth: profile.halfWidth * VOLUME_EXPANSION_FACTOR,
            halfDepth: profile.halfDepth * VOLUME_EXPANSION_FACTOR

        }));

        return { profiles: expanded, bounds: this.createBounds(expanded) };

    }

    classifyExpanded(expanded) {

        const refinedByMesh = new Map(this.refined.meshes.map((mesh) => [mesh.meshUUID, mesh]));
        const retainedMasks = this.refined.debug.retainedMasks;
        const meshes = [];
        let insideVertices = 0;
        let newlyAddedVertices = 0;
        let total = 0;
        let nonZero = 0;

        this.model.traverse((mesh) => {

            if (!mesh.isMesh || !mesh.geometry.attributes.position) return;

            const refined = refinedByMesh.get(mesh.uuid);

            if (!refined) return;

            const positions = mesh.geometry.attributes.position;
            const weights = new Float32Array(positions.count);
            const distance = this.getRetainedDistances(mesh.geometry, retainedMasks.get(mesh.uuid));
            const point = new THREE.Vector3();
            let insideCount = 0;

            for (let index = 0; index < positions.count; index++) {

                point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
                const profile = expanded.profiles[this.findNearestProfile(point.y, expanded.profiles)];
                const volumeWeight = profile && point.y >= expanded.bounds.min.y && point.y <= expanded.bounds.max.y
                    ? this.getExpandedWeight(point, profile)
                    : 0;
                const allowed = refined.weights[index] > 0 || distance[index] <= EXPANSION_ADJACENCY_STEPS;
                const finalWeight = allowed
                    ? Math.max(refined.weights[index], volumeWeight * EXPANSION_BLEND_STRENGTH)
                    : refined.weights[index];

                weights[index] = finalWeight;

                if (finalWeight > 0) {

                    insideCount++;
                    insideVertices++;
                    total += finalWeight;
                    nonZero++;

                    if (refined.weights[index] === 0) newlyAddedVertices++;

                }

            }

            meshes.push({ meshUUID: mesh.uuid, vertexCount: positions.count, weights, insideCount });

        });

        return {

            meshes,
            statistics: {

                insideVertices,
                newlyAddedVertices,
                averageNonZeroWeight: nonZero ? total / nonZero : 0

            }

        };

    }

    getExpandedWeight(point, profile) {

        const dx = (point.x - profile.centerX) / profile.halfWidth;
        const dz = (point.z - profile.centerZ) / profile.halfDepth;
        const radial = Math.sqrt(dx ** 2 + dz ** 2);

        if (radial > 1) return 0;

        return 1 - THREE.MathUtils.smoothstep(
            radial,
            1 - EXPANSION_EDGE_SOFTNESS,
            1
        );

    }

    getRetainedDistances(geometry, retainedMask) {

        const adjacency = getCachedVertexAdjacency(geometry);
        const distances = new Int16Array(retainedMask.length).fill(-1);
        const queue = [];

        retainedMask.forEach((value, index) => {

            if (value) { distances[index] = 0; queue.push(index); }

        });

        // A moving cursor avoids O(n²) array shifts on dense scan topology.
        let cursor = 0;

        while (cursor < queue.length) {

            const index = queue[cursor++];

            if (distances[index] >= EXPANSION_ADJACENCY_STEPS) continue;

            adjacency[index].forEach((neighbor) => {

                if (distances[neighbor] === -1) {

                    distances[neighbor] = distances[index] + 1;
                    queue.push(neighbor);

                }

            });

        }

        return distances;

    }

    findNearestProfile(y, profiles) {

        let best = 0;
        let distance = Infinity;

        profiles.forEach((profile, index) => {

            const centerY = (profile.yMin + profile.yMax) / 2;
            const current = Math.abs(y - centerY);

            if (current < distance) { best = index; distance = current; }

        });

        return best;

    }

    boundaryPadding(profile) {

        return (profile.yMax - profile.yMin) * VOLUME_EXPANSION_FACTOR * 0.2;

    }

    createBounds(profiles) {

        const bounds = new THREE.Box3();

        profiles.forEach((profile) => {

            bounds.expandByPoint(new THREE.Vector3(profile.centerX - profile.halfWidth, profile.yMin, profile.centerZ - profile.halfDepth));
            bounds.expandByPoint(new THREE.Vector3(profile.centerX + profile.halfWidth, profile.yMax, profile.centerZ + profile.halfDepth));

        });

        return bounds;

    }

    now() { return globalThis.performance?.now?.() ?? Date.now(); }

}
