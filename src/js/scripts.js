import { LoadingScreenStage } from "./LoadingScreen/LoadingScreenStage.js";
import { Test2LoadingVisual } from "./LoadingScreen/Test2LoadingVisual.js";
import { camera, renderScene, scene } from "./scene.js";

const loadingScreen = new LoadingScreenStage(scene, camera);
const loadingStatus = document.getElementById("loadingStatus");
const test2Visual = new Test2LoadingVisual(camera);

loadingScreen.initialize();
test2Visual.initialize().then((initialized) => {
    if (!initialized) return;

    const added = loadingScreen.addModel(test2Visual.object3D, {
        update: (deltaTime, elapsedTime) => {
            test2Visual.update(deltaTime, elapsedTime);
        },
        owned: false
    });

    if (!added) {
        test2Visual.dispose();
        return;
    }

    loadingStatus.textContent = "Visual scene ready";
}).catch((error) => {
    console.error("Unable to load the authored loading visual.", error);
    loadingStatus.textContent = "Unable to load visual scene";
});

let previousFrameTime = performance.now();
let elapsedTime = 0;

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - previousFrameTime) / 1000, 0.05);
    previousFrameTime = currentTime;
    elapsedTime += deltaTime;

    loadingScreen.update(deltaTime, elapsedTime);
    renderScene();
}

requestAnimationFrame(animate);

window.addEventListener("pagehide", () => {
    test2Visual.dispose();
    loadingScreen.dispose();
}, { once: true });
