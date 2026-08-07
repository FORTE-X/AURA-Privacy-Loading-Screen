import * as THREE from "three";

// Set to true whenever the attached torso-marker wireframe is needed.
export const TORSO_MARKER_VISIBLE = false;
export const TORSO_MARKER_COLOR = 0xdd00ff;

/**
 * Analytical torso bounds plus a model-local wireframe marker. The marker
 * performs no detection; it converts reliable world bounds into the active
 * model container's local space so it shares the model's transform hierarchy.
 *
 * Future silhouette effects should use getLocalBox(), localCenter, and
 * localSize, then attach their group to the same modelContainer:
 *
 * modelContainer
 * ├── importedModel
 * ├── torsoMarkerGroup
 * └── silhouetteEffectGroup
 */
export class TorsoMarker {

    constructor(bounds, source = "unknown") {

        if (!TorsoMarker.isValidBox(bounds)) {

            throw new Error("TorsoMarker requires a non-empty THREE.Box3.");

        }

        this.source = source;
        this.worldBounds = bounds.clone();
        this.markerGroup = new THREE.Group();
        this.markerGroup.name = "Torso Marker Group";
        this.modelContainer = null;
        this.boxLines = null;
        this.visible = TORSO_MARKER_VISIBLE;
        this.localBounds = this.worldBounds.clone();
        this.localCenter = this.localBounds.getCenter(new THREE.Vector3());
        this.localSize = this.localBounds.getSize(new THREE.Vector3());

    }

    static resolveBounds(torso) {

        const candidates = [
            { source: "selected-vertex bounds", bounds: torso?.bounds?.box },
            { source: "expanded volume", bounds: torso?.expandedVolume?.bounds },
            { source: "analytical torso volume", bounds: torso?.volume?.overallBounds },
            { source: "torso inference", bounds: torso?.boundingBox }
        ];

        return candidates.find(({ bounds }) => TorsoMarker.isValidBox(bounds)) ?? null;

    }

    static isValidBox(bounds) {

        if (!bounds?.isBox3 || bounds.isEmpty()) return false;

        const size = bounds.getSize(new THREE.Vector3());

        return size.x > 0 && size.y > 0 && size.z > 0;

    }

    attachToContainer(modelContainer) {

        if (!modelContainer?.isObject3D) {

            throw new Error("TorsoMarker requires a THREE.Object3D model container.");

        }

        modelContainer.updateWorldMatrix(true, true);
        this.modelContainer = modelContainer;
        const localTransform = modelContainer.matrixWorld.clone().invert();

        this.localBounds = this.worldBounds.clone().applyMatrix4(localTransform);
        this.localCenter = this.localBounds.getCenter(new THREE.Vector3());
        this.localSize = this.localBounds.getSize(new THREE.Vector3());

        this.rebuildBoxLines();
        modelContainer.add(this.markerGroup);

        return this;

    }

    setBounds(bounds) {

        if (!TorsoMarker.isValidBox(bounds)) {

            throw new Error("TorsoMarker requires a non-empty THREE.Box3.");

        }

        this.worldBounds = bounds.clone();

        if (this.modelContainer) {

            this.attachToContainer(this.modelContainer);

        }

        return this;

    }

    getBox() {

        return this.getWorldBox();

    }

    getCenter() {

        return this.getWorldBox().getCenter(new THREE.Vector3());

    }

    getSize() {

        return this.getWorldBox().getSize(new THREE.Vector3());

    }

    getGroup() {

        return this.markerGroup;

    }

    getLocalBox() {

        return this.localBounds.clone();

    }

    getWorldBox() {

        this.markerGroup.updateWorldMatrix(true, false);

        return this.localBounds.clone().applyMatrix4(this.markerGroup.matrixWorld);

    }

    containsPoint(worldPoint) {

        const localPoint = this.markerGroup.worldToLocal(worldPoint.clone());

        return this.localBounds.containsPoint(localPoint);

    }

    getNormalizedPosition(worldPoint) {

        const localPoint = this.markerGroup.worldToLocal(worldPoint.clone());

        return {

            x: (localPoint.x - this.localCenter.x) / (this.localSize.x / 2),
            y: (localPoint.y - this.localCenter.y) / (this.localSize.y / 2),
            z: (localPoint.z - this.localCenter.z) / (this.localSize.z / 2)

        };

    }

    setVisible(isVisible) {

        this.visible = Boolean(isVisible);
        this.markerGroup.visible = this.visible;

    }

    show() {

        this.setVisible(true);

    }

    hide() {

        this.setVisible(false);

    }

    toggle() {

        this.setVisible(!this.visible);

        return this.visible;

    }

    isVisible() {

        return this.visible;

    }

    // Retained for callers of the original marker API. The marker is already
    // parented to the model container, so no world-space helper is created.
    showDebug() {

        this.show();

    }

    hideDebug() {

        this.hide();

    }

    dispose() {

        this.boxLines?.geometry.dispose();
        this.boxLines?.material.dispose();
        this.markerGroup.removeFromParent();
        this.markerGroup.clear();
        this.boxLines = null;
        this.modelContainer = null;

    }

    rebuildBoxLines() {

        this.boxLines?.geometry.dispose();
        this.boxLines?.material.dispose();
        this.markerGroup.clear();

        const boxGeometry = new THREE.BoxGeometry(
            this.localSize.x,
            this.localSize.y,
            this.localSize.z
        );
        const edges = new THREE.EdgesGeometry(boxGeometry);

        boxGeometry.dispose();

        this.boxLines = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: TORSO_MARKER_COLOR })
        );
        this.boxLines.position.copy(this.localCenter);
        this.markerGroup.add(this.boxLines);
        this.markerGroup.visible = this.visible;

    }

}
