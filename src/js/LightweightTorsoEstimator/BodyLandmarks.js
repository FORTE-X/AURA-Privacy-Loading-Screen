import * as THREE from "three";

export const BREAST_HEIGHT_RANGE = Object.freeze([0.66, 0.76]);
export const PELVIS_HEIGHT_RANGE = Object.freeze([0.46, 0.58]);
export const BREAST_LATERAL_POSITION = 0.21;
export const BUTTOCK_LATERAL_POSITION = 0.22;
export const LANDMARK_SURFACE_OFFSET = 0.012;
export const LANDMARK_SIZE_RATIO = 0.018;

const BREAST_COLOR = 0xff4f9a;
const PELVIS_COLOR = 0x66e4ff;
const BUTTOCK_COLOR = 0xc88cff;

export class BodyLandmarks {

    constructor(estimation) {

        this.positions = estimateLandmarkPositions(estimation);
        this.group = new THREE.Group();
        this.group.name = "Lightweight Body Landmarks";
        this.geometries = [];
        this.materials = [];

        const markerHeight = estimation.bounds.max.y - estimation.bounds.min.y;
        const markerSize = Math.max(
            markerHeight * LANDMARK_SIZE_RATIO,
            Number.EPSILON
        );

        this.createBreastMarkers(markerSize);
        this.createPelvisMarker(markerSize * 1.15);
        this.createButtockMarkers(markerSize);

    }

    get object3D() {

        return this.group;

    }

    createBreastMarkers(size) {

        const geometry = new THREE.SphereGeometry(size, 16, 12);
        const material = new THREE.MeshBasicMaterial({
            color: BREAST_COLOR,
            depthTest: false
        });

        this.geometries.push(geometry);
        this.materials.push(material);

        [
            ["Left Breast Landmark", this.positions.leftBreast],
            ["Right Breast Landmark", this.positions.rightBreast]
        ].forEach(([name, position]) => {

            const marker = new THREE.Mesh(geometry, material);

            marker.name = name;
            marker.position.copy(position);
            marker.renderOrder = 1003;
            this.group.add(marker);

        });

    }

    createPelvisMarker(size) {

        const geometry = new THREE.OctahedronGeometry(size);
        const material = new THREE.MeshBasicMaterial({
            color: PELVIS_COLOR,
            depthTest: false
        });
        const marker = new THREE.Mesh(geometry, material);

        marker.name = "Pelvis Landmark";
        marker.position.copy(this.positions.pelvis);
        marker.renderOrder = 1003;
        this.geometries.push(geometry);
        this.materials.push(material);
        this.group.add(marker);

    }

    createButtockMarkers(size) {

        const geometry = new THREE.SphereGeometry(size, 16, 12);
        const material = new THREE.MeshBasicMaterial({
            color: BUTTOCK_COLOR,
            depthTest: false
        });

        this.geometries.push(geometry);
        this.materials.push(material);

        [
            ["Left Buttock Landmark", this.positions.leftButtock],
            ["Right Buttock Landmark", this.positions.rightButtock]
        ].forEach(([name, position]) => {

            const marker = new THREE.Mesh(geometry, material);

            marker.name = name;
            marker.position.copy(position);
            marker.renderOrder = 1003;
            this.group.add(marker);

        });

    }

    dispose() {

        this.group.removeFromParent();
        this.geometries.forEach((geometry) => geometry.dispose());
        this.materials.forEach((material) => material.dispose());
        this.group.clear();

    }

}

export function estimateLandmarkPositions(estimation) {

    const slices = estimation?.slices ?? [];
    const breastSlice = selectSlice(
        slices,
        BREAST_HEIGHT_RANGE,
        (slice) => slice.depth
    );
    const pelvisSlice = selectSlice(
        slices,
        PELVIS_HEIGHT_RANGE,
        (slice) => slice.width
    );

    if (!estimation?.bodyBounds) {

        throw new Error("Body bounds are required for body landmarks.");

    }

    const bodyHeight =
        estimation.bodyBounds.max.y - estimation.bodyBounds.min.y;

    if (!breastSlice || !pelvisSlice) {

        return createFallbackPositions(estimation, bodyHeight);

    }

    const breastY = estimation.bodyBounds.min.y +
        bodyHeight * breastSlice.normalizedHeight;
    const pelvisY = estimation.bodyBounds.min.y +
        bodyHeight * pelvisSlice.normalizedHeight;
    const breastOffsetX =
        breastSlice.width * BREAST_LATERAL_POSITION;
    const buttockOffsetX =
        pelvisSlice.width * BUTTOCK_LATERAL_POSITION;

    return {
        leftBreast: new THREE.Vector3(
            breastSlice.centerX - breastOffsetX,
            breastY,
            breastSlice.maxZ + LANDMARK_SURFACE_OFFSET
        ),
        rightBreast: new THREE.Vector3(
            breastSlice.centerX + breastOffsetX,
            breastY,
            breastSlice.maxZ + LANDMARK_SURFACE_OFFSET
        ),
        pelvis: new THREE.Vector3(
            pelvisSlice.centerX,
            pelvisY,
            pelvisSlice.maxZ + LANDMARK_SURFACE_OFFSET
        ),
        leftButtock: new THREE.Vector3(
            pelvisSlice.centerX - buttockOffsetX,
            pelvisY,
            pelvisSlice.minZ - LANDMARK_SURFACE_OFFSET
        ),
        rightButtock: new THREE.Vector3(
            pelvisSlice.centerX + buttockOffsetX,
            pelvisY,
            pelvisSlice.minZ - LANDMARK_SURFACE_OFFSET
        ),
        breastSlice: breastSlice.index,
        pelvisSlice: pelvisSlice.index
    };

}

function createFallbackPositions(estimation, bodyHeight) {

    const bounds = estimation.bounds;
    const center = bounds.getCenter(new THREE.Vector3());
    const width = bounds.max.x - bounds.min.x;
    const breastY = estimation.bodyBounds.min.y + bodyHeight * 0.71;
    const pelvisY = estimation.bodyBounds.min.y + bodyHeight * 0.52;
    const frontZ = bounds.max.z + LANDMARK_SURFACE_OFFSET;
    const backZ = bounds.min.z - LANDMARK_SURFACE_OFFSET;
    const buttockOffsetX = width * BUTTOCK_LATERAL_POSITION;

    return {
        leftBreast: new THREE.Vector3(
            center.x - width * BREAST_LATERAL_POSITION,
            breastY,
            frontZ
        ),
        rightBreast: new THREE.Vector3(
            center.x + width * BREAST_LATERAL_POSITION,
            breastY,
            frontZ
        ),
        pelvis: new THREE.Vector3(center.x, pelvisY, frontZ),
        leftButtock: new THREE.Vector3(
            center.x - buttockOffsetX,
            pelvisY,
            backZ
        ),
        rightButtock: new THREE.Vector3(
            center.x + buttockOffsetX,
            pelvisY,
            backZ
        ),
        breastSlice: null,
        pelvisSlice: null
    };

}

function selectSlice(slices, [minimumHeight, maximumHeight], score) {

    const candidates = slices.filter((slice) =>
        slice.normalizedHeight >= minimumHeight &&
        slice.normalizedHeight <= maximumHeight
    );

    if (candidates.length === 0) return null;

    return candidates.reduce((best, slice) =>
        score(slice) > score(best) ? slice : best
    );

}
