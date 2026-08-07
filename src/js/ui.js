import {
    loadModel,
    modelManager
} from "./loader.js";
import {
    camera,
    controls
} from "./scene.js";
import { viewerState } from "./viewerState.js";

const uploadBtn = document.getElementById("uploadBtn");

const fileInput = document.getElementById("fileInput");

const status = document.getElementById("status");

const modelList = document.getElementById("modelList");

const pauseRotationBtn = document.getElementById("pauseRotationBtn");

const resetViewBtn = document.getElementById("resetViewBtn");

const toggleTorsoMarkerBtn = document.getElementById("toggleTorsoMarkerBtn");

function updateRotationButton() {

    pauseRotationBtn.textContent = viewerState.autoRotateEnabled
        ? "Pause Rotation"
        : "Resume Rotation";
    pauseRotationBtn.dataset.mobileLabel = viewerState.autoRotateEnabled
        ? "Pause"
        : "Resume";

}

function restoreView(view) {

    if (!view) return;

    camera.position.copy(view.cameraPosition);
    camera.zoom = view.cameraZoom;
    camera.updateProjectionMatrix();
    controls.target.copy(view.controlsTarget);
    controls.update();

}

pauseRotationBtn.addEventListener("click", () => {

    viewerState.autoRotateEnabled = !viewerState.autoRotateEnabled;
    updateRotationButton();

});

resetViewBtn.addEventListener("click", () => {

    restoreView(viewerState.savedView ?? viewerState.defaultView);
    modelManager.resetActiveModelRotation();

});

updateRotationButton();

function renderModelList(models, activeModel) {

    modelList.replaceChildren();
    updateTorsoMarkerButton(activeModel);

    if (models.length === 0) {

        const emptyState = document.createElement("p");

        emptyState.className = "model-list-empty";
        emptyState.textContent = "No imported models";

        modelList.appendChild(emptyState);
        return;

    }

    models.forEach((model) => {

        const entry = document.createElement("div");

        entry.className = "model-entry";
        entry.setAttribute("role", "button");
        entry.tabIndex = 0;

        if (model.id === activeModel?.id) {

            entry.classList.add("active");

        }

        entry.addEventListener("click", () => {

            modelManager.selectModel(model.id);

        });

        entry.addEventListener("keydown", (event) => {

            if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();
                modelManager.selectModel(model.id);

            }

        });

        const icon = document.createElement("span");
        icon.className = "model-icon";
        icon.textContent = "📦";

        const details = document.createElement("span");
        details.className = "model-details";

        const name = document.createElement("span");
        name.className = "model-name";
        name.textContent = model.fileName;

        const type = document.createElement("span");
        type.className = "model-type";
        type.textContent = model.fileType;

        details.append(name, type);

        const removeButton = document.createElement("button");

        removeButton.type = "button";
        removeButton.className = "model-remove";
        removeButton.setAttribute("aria-label", `Remove ${model.fileName}`);
        removeButton.textContent = "×";

        removeButton.addEventListener("click", (event) => {

            event.stopPropagation();

            if (modelManager.removeModel(model.id) &&
                modelManager.models.length === 0) {

                status.textContent = "No Model Imported";

            }

        });

        entry.append(icon, details, removeButton);
        modelList.appendChild(entry);

    });

}

function updateTorsoMarkerButton(activeModel = modelManager.activeModel) {

    const marker = activeModel?.torsoMarker;

    toggleTorsoMarkerBtn.disabled = !marker;
    toggleTorsoMarkerBtn.textContent = marker?.visible
        ? "Hide Torso Marker"
        : "Show Torso Marker";

}

toggleTorsoMarkerBtn.addEventListener("click", () => {

    modelManager.toggleActiveTorsoMarker();
    updateTorsoMarkerButton();

});

modelManager.subscribe(renderModelList);

uploadBtn.addEventListener("click", () => {

    fileInput.click();

});

fileInput.addEventListener("change", (event) => {

    const file = event.target.files[0];

    if (!file) return;

    status.textContent = "Loading...";

    loadModel(file, status);

    // Allow selecting the same scan again after it has been removed.
    fileInput.value = "";

});
