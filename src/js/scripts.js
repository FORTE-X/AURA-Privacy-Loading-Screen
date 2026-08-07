import {
    scene,
    camera,
    renderScene,
    controls
} from "./scene.js";

import { currentModelContainer, modelManager } from "./loader.js";
import { viewerState } from "./viewerState.js";

import "./ui.js";

let previousFrameTime = performance.now();
const IDLE_ROTATION_SPEED = 0.22;

function animate(currentTime) {

    requestAnimationFrame(animate);

    const deltaTime = Math.min((currentTime - previousFrameTime) / 1000, 0.05);

    previousFrameTime = currentTime;

    // Subtle continuous rotation
    if (currentModelContainer && viewerState.autoRotateEnabled) {

        currentModelContainer.rotation.y +=
            IDLE_ROTATION_SPEED * deltaTime;

    }

    controls.update();

    renderScene();

}

animate();
