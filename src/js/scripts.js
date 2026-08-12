import {
    renderScene,
    controls
} from "./scene.js";

import "./ui.js";

function animate() {

    requestAnimationFrame(animate);

    controls.update();

    renderScene();

}

animate();
