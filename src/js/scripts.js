import { ButterflyStreamVisual } from "./LoadingScreen/ButterflyStreamVisual.js";
import { LoadingScreenStage } from "./LoadingScreen/LoadingScreenStage.js";
import { PrivacyBoxVisual } from "./LoadingScreen/PrivacyBoxVisual.js";
import { Test3LoadingVisual } from "./LoadingScreen/Test3LoadingVisual.js";
import { ModelUploadController } from "./ModelUpload/ModelUploadController.js";
import {
    camera,
    renderScene,
    scene
} from "./scene.js";

const emptyState = document.getElementById("emptyState");
const loadingInterface = document.getElementById("loadingInterface");
const loadingStatus = document.getElementById("loadingStatus");

let loadingStage = null;
let test3Visual = null;
let privacyBoxVisual = null;
let butterflyVisual = null;
let experienceGeneration = 0;
let pageDisposed = false;

const uploadController = new ModelUploadController({
    uploadButton: document.getElementById("uploadBtn"),
    fileInput: document.getElementById("fileInput"),
    modelList: document.getElementById("modelList"),
    status: document.getElementById("status"),
    onImported: (metadata) => startLoadingExperience(metadata),
    onRemoved: () => stopLoadingExperience({ showIdle: true })
});
uploadController.initialize();

async function startLoadingExperience(metadata) {
    stopLoadingExperience({ showIdle: false });

    const generation = experienceGeneration;
    const stage = new LoadingScreenStage(scene, camera);
    const mainVisual = new Test3LoadingVisual(camera);
    const boxVisual = new PrivacyBoxVisual(camera);
    const butterflies = new ButterflyStreamVisual(
        camera,
        mainVisual,
        boxVisual
    );

    loadingStage = stage;
    test3Visual = mainVisual;
    privacyBoxVisual = boxVisual;
    butterflyVisual = butterflies;

    emptyState.hidden = true;
    loadingInterface.hidden = false;
    loadingStatus.textContent = `Securing ${metadata.name}`;
    stage.initialize();

    const [mainResult, boxResult] = await Promise.allSettled([
        mainVisual.initialize(),
        boxVisual.initialize()
    ]);

    if (!isCurrentExperience(generation, stage)) return;

    const mainReady = addInitializedVisual(
        stage,
        mainResult,
        mainVisual,
        "authored loading visual"
    );
    const boxReady = addInitializedVisual(
        stage,
        boxResult,
        boxVisual,
        "privacy safe box"
    );

    if (!mainReady) {
        uploadController.setStatus(
            "Model imported, but the privacy visual could not start.",
            { error: true }
        );
        stopLoadingExperience({ showIdle: true });
        return;
    }

    if (!boxReady) {
        loadingStatus.textContent = "Privacy visual active — safe box unavailable";
        uploadController.setStatus(
            "Model imported. Privacy loading is active without the safe box."
        );
        return;
    }

    const butterflyResult = await settle(butterflies.initialize());

    if (!isCurrentExperience(generation, stage)) return;

    const butterfliesReady = addInitializedVisual(
        stage,
        butterflyResult,
        butterflies,
        "butterfly stream"
    );

    loadingStatus.textContent = butterfliesReady
        ? "Privacy loading active"
        : "Privacy loading active — butterflies unavailable";
    uploadController.setStatus(
        butterfliesReady
            ? "Model imported securely. Privacy loading is active."
            : "Model imported. Privacy loading is active without butterflies."
    );
}

function stopLoadingExperience({ showIdle }) {
    experienceGeneration += 1;
    butterflyVisual?.dispose();
    test3Visual?.dispose();
    privacyBoxVisual?.dispose();
    loadingStage?.dispose();

    butterflyVisual = null;
    test3Visual = null;
    privacyBoxVisual = null;
    loadingStage = null;

    if (showIdle && !pageDisposed) {
        emptyState.hidden = false;
        loadingInterface.hidden = true;
        loadingStatus.textContent = "Importing your model securely";
    }
}

function isCurrentExperience(generation, stage) {
    return !pageDisposed &&
        generation === experienceGeneration &&
        stage === loadingStage;
}

function addInitializedVisual(stage, result, visual, label) {
    if (result.status === "rejected") {
        console.error(`Unable to load the ${label}.`, result.reason);
        return false;
    }

    if (!result.value) return false;

    const added = stage.addModel(visual.object3D, {
        update: (deltaTime, elapsedTime) => {
            visual.update(deltaTime, elapsedTime);
        },
        owned: false
    });

    if (!added) visual.dispose();
    return added;
}

async function settle(promise) {
    try {
        return { status: "fulfilled", value: await promise };
    } catch (reason) {
        return { status: "rejected", reason };
    }
}

let previousFrameTime = performance.now();
let elapsedTime = 0;

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - previousFrameTime) / 1000, 0.05);

    previousFrameTime = currentTime;
    elapsedTime += deltaTime;

    loadingStage?.update(deltaTime, elapsedTime);
    renderScene();
}

requestAnimationFrame(animate);

window.addEventListener("pagehide", () => {
    pageDisposed = true;
    uploadController.dispose();
    stopLoadingExperience({ showIdle: false });
}, { once: true });
