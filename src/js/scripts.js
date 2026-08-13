import { LoadingScreenStage } from "./LoadingScreen/LoadingScreenStage.js";
import { Test3LoadingVisual } from "./LoadingScreen/Test3LoadingVisual.js";
import { camera, renderScene, scene } from "./scene.js";

const loadingScreen = new LoadingScreenStage(scene, camera);
const loadingStatus = document.getElementById("loadingStatus");
const test3Visual = new Test3LoadingVisual(camera);

loadingScreen.initialize();
test3Visual.initialize().then((initialized) => {
    if (!initialized) return;

    const added = loadingScreen.addModel(test3Visual.object3D, {
        update: (deltaTime, elapsedTime) => {
            test3Visual.update(deltaTime, elapsedTime);
        },
        owned: false
    });

    if (!added) {
        test3Visual.dispose();
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
    test3Visual.dispose();
    loadingScreen.dispose();
}, { once: true });
