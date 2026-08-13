import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

import {
    scene,
    camera,
    controls
} from "./scene.js";

import { ModelManager } from "./ModelManager.js";
import {
    estimateTorsoBounds
} from "./LightweightTorsoEstimator/LightweightTorsoEstimator.js";
import {
    TorsoMarker
} from "./LightweightTorsoEstimator/TorsoMarker.js";
import { PortraitPortal } from "./PortraitPortal/PortraitPortal.js";
import {
    InvertedHullOutline
} from "./GlowingOutline/InvertedHullOutline.js";
import {
    FrontFloralOverlay
} from "./FrontFloralOverlay/FrontFloralOverlay.js";

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const fbxLoader = new FBXLoader();
export const IMPORTED_MODEL_COLOR = 0x010102;
export const IMPORTED_MODEL_EMISSIVE = 0x000000;
export const IMPORTED_MODEL_OPACITY = 1;
export const IMPORTED_MODEL_ROUGHNESS = 0.82;
export const IMPORTED_MODEL_METALNESS = 0;
// Hide the lowest 32% of the scan for the fixed upper-body portrait.
export const PORTRAIT_LOWER_BODY_CUTOFF_RATIO = 0.32;

// Retained imported-model reference for existing consumers.
export let currentModel = null;
// The container owns idle rotation; its children remain aligned to the scan.
export let currentModelContainer = null;

export const modelManager = new ModelManager(scene, camera, controls);

modelManager.subscribe((models, activeModel) => {

    currentModel = activeModel?.model ?? null;
    currentModelContainer = activeModel?.modelContainer ?? null;

});

export function removeActiveModel() {

    return modelManager.removeActiveModel();

}

export function loadModel(file, status) {

    const extension = file.name
        .split(".")
        .pop()
        .toLowerCase();

    const url = URL.createObjectURL(file);

    let loader;

    switch (extension) {

        case "glb":
        case "gltf":
            loader = gltfLoader;
            break;

        case "obj":
            loader = objLoader;
            break;

        case "fbx":
            loader = fbxLoader;
            break;

        default:
            status.textContent = "Unsupported File Type";
            URL.revokeObjectURL(url);
            return;

    }

    loader.load(

        url,

        (result) => {


            // GLTF returns scene
            const importedModel =
                result.scene ? result.scene : result;

            // Reset rotation
            importedModel.rotation.set(0, 0, 0);

            //--------------------------------------------------
            // Calculate Bounding Box
            //--------------------------------------------------

            const box = new THREE.Box3().setFromObject(importedModel);

            const center = box.getCenter(new THREE.Vector3());

            importedModel.position.sub(center);

            //--------------------------------------------------
            // Place feet on the ground
            //--------------------------------------------------

            box.setFromObject(importedModel);

            importedModel.position.y -= box.min.y;

            //--------------------------------------------------
            // Camera Fit
            //--------------------------------------------------

            box.setFromObject(importedModel);

            const cutoffY = THREE.MathUtils.lerp(
                box.min.y,
                box.max.y,
                PORTRAIT_LOWER_BODY_CUTOFF_RATIO
            );
            const portraitBox = box.clone();

            portraitBox.min.y = cutoffY;

            const sphere = portraitBox.getBoundingSphere(
                new THREE.Sphere()
            );

            const radius = sphere.radius;

            const modelCenter = sphere.center;

            const fov = THREE.MathUtils.degToRad(camera.fov);

            let distance =
                radius /
                Math.sin(fov / 2);

            // Leave enough portrait margin for the animated portal ripples.
            distance *= 1.02;

            camera.position.set(

                modelCenter.x,

                modelCenter.y,

                modelCenter.z + distance

            );

            controls.target.copy(modelCenter);

            controls.update();

            //--------------------------------------------------
            // Enable Shadows
            //--------------------------------------------------

            const importedMaterial = createImportedModelMaterial(cutoffY);
            const replacedMaterials = new Set();

            importedModel.traverse((child) => {

                if (child.isMesh) {

                    child.castShadow = true;
                    child.receiveShadow = true;

                    const sourceMaterials = Array.isArray(child.material)
                        ? child.material
                        : [child.material];

                    sourceMaterials.forEach((material) => {

                        if (material) replacedMaterials.add(material);

                    });

                    child.material = Array.isArray(child.material)
                        ? sourceMaterials.map(() => importedMaterial)
                        : importedMaterial;

                }

            });

            disposeReplacedMaterials(replacedMaterials);

            const cameraView = {

                position: camera.position.clone(),
                target: controls.target.clone()

            };
            const portraitPortal = new PortraitPortal(
                importedModel,
                box,
                cutoffY
            );
            let glowingOutline = null;
            let frontFloralOverlay = null;

            try {

                glowingOutline = new InvertedHullOutline(
                    importedModel,
                    box,
                    cutoffY
                );

            } catch (error) {

                console.warn("Glowing outline creation failed.", error);

            }

            try {

                frontFloralOverlay = new FrontFloralOverlay(box, cutoffY);

            } catch (error) {

                console.warn("Front floral overlay creation failed.", error);

            }

            const modelEntry = modelManager.addModel({

                model: importedModel,
                file,
                cameraView,
                portraitPortal,
                glowingOutline,
                frontFloralOverlay

            });

            if (frontFloralOverlay) {

                frontFloralOverlay.initialize().then((initialized) => {

                    if (!initialized) return;

                    console.log("Front floral overlay ready.");

                }).catch((error) => {

                    console.warn("Front floral overlay failed.", error);
                    frontFloralOverlay.dispose();

                });

            }

            scheduleTorsoMarker(modelEntry);

            status.textContent = "Model Imported Successfully";

            URL.revokeObjectURL(url);

        },

        undefined,

        (error) => {

            console.error(error);

            status.textContent =
                "Import Failed";

            URL.revokeObjectURL(url);

        }

    );

}

function scheduleTorsoMarker(modelEntry) {

    const estimate = () => {

        if (!modelManager.models.some((entry) => entry.id === modelEntry.id)) {

            return;

        }

        try {

            const estimation = estimateTorsoBounds(
                modelEntry.model,
                modelEntry.modelContainer
            );
            const marker = new TorsoMarker(estimation);

            if (!modelManager.setTorsoMarker(modelEntry.id, marker)) return;

            console.log("Lightweight torso estimate:", {
                method: estimation.method,
                slices: estimation.sliceCount,
                excludedArmSamples: estimation.excludedArmSamples,
                vertices: estimation.vertexCount,
                center: estimation.bounds.getCenter(new THREE.Vector3()),
                size: estimation.bounds.getSize(new THREE.Vector3())
            });
            console.log("Lightweight body landmarks:", {
                leftBreast: marker.landmarks.positions.leftBreast,
                rightBreast: marker.landmarks.positions.rightBreast,
                pelvis: marker.landmarks.positions.pelvis,
                leftButtock: marker.landmarks.positions.leftButtock,
                rightButtock: marker.landmarks.positions.rightButtock
            });

        } catch (error) {

            console.warn("Lightweight torso estimation failed.", error);

        }

    };

    // Let the uploaded model paint before starting CPU-heavy torso estimation.
    requestAnimationFrame(() => requestAnimationFrame(() => {

        if ("requestIdleCallback" in window) {

            window.requestIdleCallback(estimate, { timeout: 800 });

        } else {

            window.setTimeout(estimate, 100);

        }

    }));

}

/** Creates a light-absorbing silhouette material with restrained violet edges. */
function createImportedModelMaterial(cutoffY) {

    return new THREE.MeshPhysicalMaterial({
        color: IMPORTED_MODEL_COLOR,
        emissive: IMPORTED_MODEL_EMISSIVE,
        emissiveIntensity: 0,
        opacity: IMPORTED_MODEL_OPACITY,
        transparent: false,
        depthWrite: true,
        side: THREE.DoubleSide,
        roughness: IMPORTED_MODEL_ROUGHNESS,
        metalness: IMPORTED_MODEL_METALNESS,
        ior: 1.5,
        specularIntensity: 0.045,
        specularColor: 0x32183b,
        clearcoat: 0.01,
        clearcoatRoughness: 0.86,
        sheen: 0.025,
        sheenRoughness: 0.82,
        sheenColor: 0x381344,
        envMapIntensity: 0.025,
        clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutoffY)],
        clipShadows: true
    });

}

function disposeReplacedMaterials(materials) {

    const disposedTextures = new Set();

    materials.forEach((material) => {

        Object.values(material).forEach((value) => {

            if (value?.isTexture && !disposedTextures.has(value)) {

                value.dispose();
                disposedTextures.add(value);

            }

        });

        material.dispose();

    });

}
