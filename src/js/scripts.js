import { LoadingScreenStage } from "./LoadingScreen/LoadingScreenStage.js";
import { camera, renderScene, scene } from "./scene.js";

const loadingScreen = new LoadingScreenStage(scene, camera);
loadingScreen.initialize();

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

window.addEventListener("pagehide", () => loadingScreen.dispose(), { once: true });
