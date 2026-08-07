import * as THREE from "three";

/**
 * Reconstructs an analytical torso volume from ordered measured slices. This
 * data object is intentionally not a Three.js renderable mesh.
 */
export class TorsoVolume {

    constructor(bodyAnalysis) {

        this.bodyAnalysis = bodyAnalysis;

    }

    reconstruct() {

        const torso = this.bodyAnalysis.getTorso();

        if (!torso) return null;

        const slices = this.bodyAnalysis.getSlices()
            .slice(torso.startSlice, torso.endSlice + 1)
            .map((slice, offset) => ({

                sliceIndex: torso.startSlice + offset,
                width: slice.width,
                depth: slice.depth,
                center: slice.center.clone(),
                minY: slice.minY,
                maxY: slice.maxY

            }));
        const centerLine = slices.map((slice) => slice.center.clone());

        return {

            slices,
            // Consecutive points define the analytical connections between
            // neighboring torso cross-sections.
            centerLine,
            overallBounds: this.createBounds(slices),
            averageWidth: this.calculateAverage(slices, "width"),
            averageDepth: this.calculateAverage(slices, "depth"),
            estimatedVolume: this.estimateVolume(slices),
            confidence: torso.confidence

        };

    }

    createBounds(slices) {

        const bounds = new THREE.Box3();

        slices.forEach((slice) => {

            bounds.expandByPoint(new THREE.Vector3(
                slice.center.x - slice.width / 2,
                slice.minY,
                slice.center.z - slice.depth / 2
            ));
            bounds.expandByPoint(new THREE.Vector3(
                slice.center.x + slice.width / 2,
                slice.maxY,
                slice.center.z + slice.depth / 2
            ));

        });

        return bounds;

    }

    calculateAverage(slices, property) {

        if (slices.length === 0) return 0;

        return slices.reduce(
            (sum, slice) => sum + slice[property],
            0
        ) / slices.length;

    }

    estimateVolume(slices) {

        let volume = 0;

        for (let index = 1; index < slices.length; index++) {

            const previous = slices[index - 1];
            const current = slices[index];
            const previousArea = previous.width * previous.depth;
            const currentArea = current.width * current.depth;
            const height = Math.abs(
                current.center.y - previous.center.y
            );

            // Trapezoidal integration links consecutive cross-sections.
            volume += (previousArea + currentArea) * height / 2;

        }

        return volume;

    }

}
