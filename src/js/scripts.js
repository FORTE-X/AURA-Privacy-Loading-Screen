import {
    renderScene,
    controls
} from "./scene.js";
import { modelManager } from "./loader.js";

import "./ui.js";

let previousFrameTime = performance.now();
let elapsedTime = 0;

function animate(currentTime) {

    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - previousFrameTime) / 1000, 0.05);

    previousFrameTime = currentTime;
    elapsedTime += deltaTime;

    modelManager.models.forEach((entry) => {
        entry.portraitPortal?.update(deltaTime, elapsedTime);
    });

    controls.update();

    renderScene();

}

requestAnimationFrame(animate);
