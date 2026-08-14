import { LoadingScreenStage } from "./LoadingScreen/LoadingScreenStage.js";
import { PrivacyBoxVisual } from "./LoadingScreen/PrivacyBoxVisual.js";
import { Test3LoadingVisual } from "./LoadingScreen/Test3LoadingVisual.js";
import {
    camera,
    controls,
    disposeSceneControls,
    renderScene,
    scene,
    updateSceneControls
} from "./scene.js";

const loadingScreen = new LoadingScreenStage(scene, camera);
const loadingStatus = document.getElementById("loadingStatus");
const test3Visual = new Test3LoadingVisual(camera);
const privacyBoxVisual = new PrivacyBoxVisual(camera);
const handleModelInteraction = () => test3Visual.scatterParticles();
let pageDisposed = false;

loadingScreen.initialize();
controls.addEventListener("start", handleModelInteraction);
initializeLoadingVisuals();

async function initializeLoadingVisuals() {
    const [mainResult, boxResult] = await Promise.allSettled([
        test3Visual.initialize(),
        privacyBoxVisual.initialize()
    ]);

    if (pageDisposed) return;

    const mainReady = addInitializedVisual(
        mainResult,
        test3Visual,
        "authored loading visual"
    );
    const boxReady = addInitializedVisual(
        boxResult,
        privacyBoxVisual,
        "privacy safe box"
    );

    if (!mainReady) {
        loadingStatus.textContent = "Unable to load visual scene";
        return;
    }

    loadingStatus.textContent = boxReady
        ? "Visual scene ready"
        : "Visual scene ready — safe box unavailable";
}

function addInitializedVisual(result, visual, label) {
    if (result.status === "rejected") {
        console.error(`Unable to load the ${label}.`, result.reason);
        return false;
    }

    if (!result.value) return false;

    const added = loadingScreen.addModel(visual.object3D, {
        update: (deltaTime, elapsedTime) => {
            visual.update(deltaTime, elapsedTime);
        },
        owned: false
    });

    if (!added) visual.dispose();
    return added;
}

let previousFrameTime = performance.now();
let elapsedTime = 0;

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - previousFrameTime) / 1000, 0.05);
    previousFrameTime = currentTime;
    elapsedTime += deltaTime;

    updateSceneControls();
    loadingScreen.update(deltaTime, elapsedTime);
    renderScene();
}

requestAnimationFrame(animate);

window.addEventListener("pagehide", () => {
    pageDisposed = true;
    controls.removeEventListener("start", handleModelInteraction);
    test3Visual.dispose();
    privacyBoxVisual.dispose();
    loadingScreen.dispose();
    disposeSceneControls();
}, { once: true });
