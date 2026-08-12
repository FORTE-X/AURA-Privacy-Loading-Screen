import * as THREE from "three";

export const OUTLINE_COLOR = 0xf08cff;
export const OUTLINE_THICKNESS_RATIO = 0.00115;
export const OUTLINE_OPACITY = 0.58;
export const OUTLINE_GLOW_STRENGTH = 1.9;
export const OUTLINE_HALO_THICKNESS_RATIO = 0.0032;
export const OUTLINE_HALO_OPACITY = 0.1;
export const OUTLINE_HALO_STRENGTH = 1.15;

const minimumScale = 1e-6;
const temporaryPosition = new THREE.Vector3();
const temporaryScale = new THREE.Vector3();

/**
 * Builds an anime-style inverted hull without changing the imported geometry.
 * Each duplicate is expanded along its vertex normals and renders back faces
 * only, leaving a narrow silhouette around the opaque source mesh.
 */
export class InvertedHullOutline {

    constructor(sourceModel, bounds, cutoffY) {

        if (!sourceModel?.isObject3D || !bounds || bounds.isEmpty()) {
            throw new Error("Glowing outline requires a valid model and bounds.");
        }

        if (!Number.isFinite(cutoffY)) {
            throw new Error("Glowing outline requires a valid portrait cutoff.");
        }

        this.group = new THREE.Group();
        this.group.name = "Imported Model Glowing Outline";
        this.geometries = [];
        this.materials = [];
        this.disposed = false;

        const modelHeight = bounds.getSize(new THREE.Vector3()).y;
        const worldThickness = Math.max(
            modelHeight * OUTLINE_THICKNESS_RATIO,
            Number.EPSILON
        );
        const haloWorldThickness = Math.max(
            modelHeight * OUTLINE_HALO_THICKNESS_RATIO,
            worldThickness
        );

        this.material = createOutlineMaterial(
            cutoffY,
            OUTLINE_OPACITY,
            OUTLINE_GLOW_STRENGTH
        );
        this.haloMaterial = createOutlineMaterial(
            cutoffY,
            OUTLINE_HALO_OPACITY,
            OUTLINE_HALO_STRENGTH
        );
        this.materials.push(this.material, this.haloMaterial);
        sourceModel.updateWorldMatrix(true, true);

        sourceModel.traverse((sourceMesh) => {

            if (!sourceMesh.isMesh || !sourceMesh.geometry?.attributes.position) {
                return;
            }

            let geometry;
            let haloGeometry;

            try {

                geometry = createExpandedGeometry(sourceMesh, worldThickness);
                haloGeometry = createExpandedGeometry(
                    sourceMesh,
                    haloWorldThickness
                );

            } catch (error) {

                geometry?.dispose();
                haloGeometry?.dispose();

                console.warn(
                    `Skipping outline for ${sourceMesh.name || "unnamed mesh"}.`,
                    error
                );
                return;

            }

            const outlineMesh = new THREE.Mesh(geometry, this.material);
            const haloMesh = new THREE.Mesh(haloGeometry, this.haloMaterial);

            outlineMesh.name = `${sourceMesh.name || "Imported Mesh"} Outline`;
            haloMesh.name = `${sourceMesh.name || "Imported Mesh"} Glow Halo`;
            configureOutlineMesh(outlineMesh, sourceMesh, 6);
            configureOutlineMesh(haloMesh, sourceMesh, 5);

            this.group.add(haloMesh);
            this.group.add(outlineMesh);
            this.geometries.push(geometry, haloGeometry);

        });

        if (this.geometries.length === 0) {
            this.materials.forEach((material) => material.dispose());
            throw new Error("The imported model contains no outlineable meshes.");
        }

    }

    get object3D() {

        return this.group;

    }

    show() {

        this.group.visible = true;

    }

    hide() {

        this.group.visible = false;

    }

    dispose() {

        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        this.geometries.forEach((geometry) => geometry.dispose());
        this.materials.forEach((material) => material.dispose());
        this.geometries.length = 0;
        this.materials.length = 0;
        this.group.clear();

    }

}

function configureOutlineMesh(mesh, sourceMesh, renderOrder) {

    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(sourceMesh.matrixWorld);
    mesh.frustumCulled = sourceMesh.frustumCulled;
    mesh.renderOrder = renderOrder;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

}

function createExpandedGeometry(sourceMesh, worldThickness) {

    const geometry = sourceMesh.geometry.clone();
    const positions = geometry.getAttribute("position");

    if (sourceMesh.isSkinnedMesh &&
        typeof sourceMesh.applyBoneTransform === "function") {

        sourceMesh.skeleton?.update();

        for (let index = 0; index < positions.count; index++) {

            temporaryPosition.fromBufferAttribute(positions, index);
            sourceMesh.applyBoneTransform(index, temporaryPosition);
            positions.setXYZ(
                index,
                temporaryPosition.x,
                temporaryPosition.y,
                temporaryPosition.z
            );

        }

        positions.needsUpdate = true;
        geometry.computeVertexNormals();

    } else if (!geometry.getAttribute("normal")) {

        geometry.computeVertexNormals();

    }

    const normals = geometry.getAttribute("normal");

    if (!normals || normals.count !== positions.count) {
        geometry.dispose();
        throw new Error(`Cannot calculate outline normals for ${sourceMesh.name}.`);
    }

    sourceMesh.getWorldScale(temporaryScale);

    const maximumScale = Math.max(
        Math.abs(temporaryScale.x),
        Math.abs(temporaryScale.y),
        Math.abs(temporaryScale.z),
        minimumScale
    );
    const localThickness = worldThickness / maximumScale;

    for (let index = 0; index < positions.count; index++) {

        positions.setXYZ(
            index,
            positions.getX(index) + normals.getX(index) * localThickness,
            positions.getY(index) + normals.getY(index) * localThickness,
            positions.getZ(index) + normals.getZ(index) * localThickness
        );

    }

    positions.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;

}

function createOutlineMaterial(cutoffY, opacity, glowStrength) {

    const color = new THREE.Color(OUTLINE_COLOR);

    color.multiplyScalar(glowStrength);

    return new THREE.MeshBasicMaterial({
        color,
        side: THREE.BackSide,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        clippingPlanes: [
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutoffY)
        ]
    });

}
