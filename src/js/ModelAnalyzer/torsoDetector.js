import * as THREE from "three";

// Default scan-unit slice height (2 cm when source models use meters).
export const DEFAULT_SLICE_HEIGHT = 0.02;

/**
 * Lightweight, self-contained measurement result for one populated horizontal
 * section of a model. It contains no source-geometry vertex references, so it
 * can be passed directly to a future BodyAnalyzer.
 */
export class Slice {

    constructor(bounds) {

        this.minX = bounds.minX;
        this.maxX = bounds.maxX;
        this.minY = bounds.minY;
        this.maxY = bounds.maxY;
        this.minZ = bounds.minZ;
        this.maxZ = bounds.maxZ;

        this.width = this.maxX - this.minX;
        this.depth = this.maxZ - this.minZ;
        this.crossSectionalArea = this.width * this.depth;
        this.center = new THREE.Vector3(
            this.minX + this.width / 2,
            this.minY + (this.maxY - this.minY) / 2,
            this.minZ + this.depth / 2
        );
        this.vertexCount = bounds.vertexCount;

    }

}

/**
 * Produces non-destructive horizontal measurements for an imported model.
 *
 * The result intentionally contains bounds and aggregate values only. Keeping
 * vertex arrays is unnecessary for the current geometry-analysis phase and
 * becomes expensive for high-resolution body scans.
 */
export class SliceAnalyzer {

    constructor(sliceHeight = DEFAULT_SLICE_HEIGHT) {

        if (sliceHeight <= 0) {

            throw new Error("Slice height must be greater than zero.");

        }

        this.sliceHeight = sliceHeight;

    }

    analyze(model) {

        // Ensure child.matrixWorld represents the model's final imported pose.
        model.updateWorldMatrix(true, true);

        const bodyBox = new THREE.Box3().setFromObject(model);
        const minY = bodyBox.min.y;
        const maxY = bodyBox.max.y;
        const sliceCount = Math.max(
            1,
            Math.ceil((maxY - minY) / this.sliceHeight)
        );

        const sliceBounds = Array.from(
            { length: sliceCount },
            () => this.createEmptyBounds()
        );

        model.traverse((child) => {

            if (!child.isMesh || !child.geometry.attributes.position) return;

            const positions = child.geometry.attributes.position;
            const vertex = new THREE.Vector3();

            for (let i = 0; i < positions.count; i++) {

                vertex.fromBufferAttribute(positions, i);
                vertex.applyMatrix4(child.matrixWorld);

                const sliceIndex = this.getSliceIndex(
                    vertex.y,
                    minY,
                    sliceCount
                );

                this.expandBounds(sliceBounds[sliceIndex], vertex);

            }

        });

        return {

            bodyBox,
            sliceHeight: this.sliceHeight,
            slices: sliceBounds
                .filter((bounds) => bounds.vertexCount > 0)
                .map((bounds) => new Slice(bounds))

        };

    }

    getSliceIndex(y, minY, sliceCount) {

        const rawIndex = Math.floor((y - minY) / this.sliceHeight);

        // Clamp the upper boundary so vertices exactly at maxY stay in the
        // final slice instead of producing an out-of-range array index.
        return THREE.MathUtils.clamp(rawIndex, 0, sliceCount - 1);

    }

    createEmptyBounds() {

        return {

            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
            minZ: Infinity,
            maxZ: -Infinity,
            vertexCount: 0

        };

    }

    expandBounds(bounds, vertex) {

        bounds.minX = Math.min(bounds.minX, vertex.x);
        bounds.maxX = Math.max(bounds.maxX, vertex.x);
        bounds.minY = Math.min(bounds.minY, vertex.y);
        bounds.maxY = Math.max(bounds.maxY, vertex.y);
        bounds.minZ = Math.min(bounds.minZ, vertex.z);
        bounds.maxZ = Math.max(bounds.maxZ, vertex.z);
        bounds.vertexCount++;

    }

}

/*
 * Compatibility entry point used by the existing importer. Despite its legacy
 * name, it performs geometry measurement only; no torso detection occurs.
 */
export function detectTorso(model) {

    return new SliceAnalyzer().analyze(model);

}
