import * as THREE from "three";

export const BOUNDS_WEIGHT_THRESHOLD = 0.25;
export const TORSO_BOUNDS_COLOR = 0x00ffff;
export const BOUND_PADDING_X = 0.05;
export const BOUND_PADDING_Y = 0.05;
export const BOUND_PADDING_Z = 0.05;
// The attached TorsoMarker is now the only visible torso-bound debug aid.
export const DEBUG_TORSO_BOUNDS = false;
export const DEBUG_TORSO_CENTER = false;

/**
 * Computes and optionally renders the padded global bounds of selected torso
 * vertices. It owns only debug helpers and never changes source geometry.
 */
export class TorsoBoundsVisualizer {

    constructor() {

        this.group = new THREE.Group();
        this.group.name = "Torso Bounds Debug";

    }

    update(model, bodyAnalysis, scene) {

        this.clear();

        const bounds = bodyAnalysis.torso.bounds;

        if (!bounds) return;

        if (DEBUG_TORSO_BOUNDS) {

            this.group.add(new THREE.Box3Helper(
                bounds.box.clone(),
                TORSO_BOUNDS_COLOR
            ));

        }

        if (DEBUG_TORSO_CENTER) {

            const marker = new THREE.Mesh(
                new THREE.SphereGeometry(0.035, 12, 8),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );

            marker.position.copy(bounds.center);
            this.group.add(marker);

        }

        if (this.group.children.length > 0) scene.add(this.group);

        console.log("Torso Bounds:", {
            size: bounds.size,
            center: bounds.center,
            totalIncludedVertices: bounds.totalIncludedVertices
        });

    }

    clear() {

        this.group.traverse((child) => {

            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();

        });

        this.group.removeFromParent();
        this.group.clear();

    }

    static calculate(model, bodyAnalysis) {

        const classification = bodyAnalysis.torso.expandedVertexClassification ??
            bodyAnalysis.torso.refinedVertexClassification ??
            bodyAnalysis.torso.vertexClassification;
        const byMesh = new Map(
            classification.meshes.map((mesh) => [mesh.meshUUID, mesh])
        );
        const box = new THREE.Box3();
        const point = new THREE.Vector3();
        let totalIncludedVertices = 0;

        model.updateWorldMatrix(true, true);
        model.traverse((mesh) => {

            if (!mesh.isMesh || !mesh.geometry.attributes.position) return;

            const weights = byMesh.get(mesh.uuid)?.weights;

            if (!weights) return;

            const positions = mesh.geometry.attributes.position;

            for (let index = 0; index < weights.length; index++) {

                if (weights[index] < BOUNDS_WEIGHT_THRESHOLD) continue;

                point.fromBufferAttribute(positions, index);
                point.applyMatrix4(mesh.matrixWorld);
                box.expandByPoint(point);
                totalIncludedVertices++;

            }

        });

        if (totalIncludedVertices === 0) return null;

        box.min.x -= BOUND_PADDING_X;
        box.max.x += BOUND_PADDING_X;
        box.min.y -= BOUND_PADDING_Y;
        box.max.y += BOUND_PADDING_Y;
        box.min.z -= BOUND_PADDING_Z;
        box.max.z += BOUND_PADDING_Z;

        return {

            box,
            center: box.getCenter(new THREE.Vector3()),
            size: box.getSize(new THREE.Vector3()),
            min: box.min.clone(),
            max: box.max.clone(),
            totalIncludedVertices

        };

    }

}

export const torsoBoundsVisualizer = new TorsoBoundsVisualizer();
