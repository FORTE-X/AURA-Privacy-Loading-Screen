import * as THREE from "three";

// The final marker is split into these equal-height horizontal layers.
export const TOTAL_MARKER_LAYERS = 7;
// Removing one layer shortens the marker by 1 / TOTAL_MARKER_LAYERS.
export const LAYERS_TO_REMOVE_FROM_TOP = 1;

/**
 * Refines an already-detected torso marker without changing torso inference.
 * It removes complete upper latitude layers so face and neck geometry is not
 * eligible for effects that consume the final marker.
 */
export class TorsoMarkerRefiner {

    static refine(bounds) {

        if (!bounds?.isBox3 || bounds.isEmpty()) {

            throw new Error("Torso marker refinement requires a non-empty THREE.Box3.");

        }

        if (TOTAL_MARKER_LAYERS < 2 ||
            LAYERS_TO_REMOVE_FROM_TOP < 0 ||
            LAYERS_TO_REMOVE_FROM_TOP >= TOTAL_MARKER_LAYERS) {

            throw new Error("Torso marker layer configuration is invalid.");

        }

        const originalBounds = bounds.clone();
        const originalHeight = originalBounds.max.y - originalBounds.min.y;
        const retainedLayerRatio =
            (TOTAL_MARKER_LAYERS - LAYERS_TO_REMOVE_FROM_TOP) /
            TOTAL_MARKER_LAYERS;
        const box = originalBounds.clone();

        box.max.y = originalBounds.min.y + originalHeight * retainedLayerRatio;

        return {

            box,
            min: box.min.clone(),
            max: box.max.clone(),
            center: box.getCenter(new THREE.Vector3()),
            size: box.getSize(new THREE.Vector3()),
            originalBounds,
            totalLayers: TOTAL_MARKER_LAYERS,
            removedTopLayers: LAYERS_TO_REMOVE_FROM_TOP,
            removedPercentage: LAYERS_TO_REMOVE_FROM_TOP / TOTAL_MARKER_LAYERS

        };

    }

}
