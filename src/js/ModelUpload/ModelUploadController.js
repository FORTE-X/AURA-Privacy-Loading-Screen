const SUPPORTED_EXTENSIONS = new Set(["glb", "gltf", "obj", "fbx"]);
const HEADER_BYTES = 64 * 1024;

/** Validates one local model and exposes it only as import metadata. */
export class ModelUploadController {

    constructor({
        uploadButton,
        fileInput,
        modelList,
        status,
        onImported,
        onRemoved
    }) {
        this.uploadButton = uploadButton;
        this.fileInput = fileInput;
        this.modelList = modelList;
        this.status = status;
        this.onImported = onImported;
        this.onRemoved = onRemoved;
        this.currentModel = null;
        this.importGeneration = 0;
        this.disposed = false;
        this.handleUploadClick = () => this.fileInput.click();
        this.handleFileChange = () => this.importSelectedFile();
    }

    initialize() {
        if (this.disposed) return;

        this.uploadButton.addEventListener("click", this.handleUploadClick);
        this.fileInput.addEventListener("change", this.handleFileChange);
    }

    setStatus(message, { error = false } = {}) {
        this.status.textContent = message;
        this.status.classList.toggle("is-error", error);
    }

    async importSelectedFile() {
        const file = this.fileInput.files?.[0];

        this.fileInput.value = "";
        if (!file || this.disposed) return;

        const generation = ++this.importGeneration;

        this.uploadButton.disabled = true;
        this.setStatus(`Validating ${file.name}...`);

        try {
            const metadata = await validateModelFile(file);

            if (this.disposed || generation !== this.importGeneration) return;

            this.currentModel = metadata;
            this.renderCurrentModel();
            this.setStatus("Model imported. Starting privacy loading...");
            await this.onImported?.(metadata);
        } catch (error) {
            if (this.disposed || generation !== this.importGeneration) return;

            console.error("Unable to import the selected model.", error);
            this.setStatus(error.message || "Unable to import this model.", {
                error: true
            });
        } finally {
            if (!this.disposed && generation === this.importGeneration) {
                this.uploadButton.disabled = false;
            }
        }
    }

    removeCurrentModel() {
        if (!this.currentModel || this.disposed) return;

        this.importGeneration += 1;
        this.currentModel = null;
        this.uploadButton.disabled = false;
        this.renderCurrentModel();
        this.setStatus("Waiting for a model.");
        this.onRemoved?.();
    }

    renderCurrentModel() {
        this.modelList.replaceChildren();

        if (!this.currentModel) {
            const empty = document.createElement("p");

            empty.className = "model-list-empty";
            empty.textContent = "No model imported";
            this.modelList.append(empty);
            return;
        }

        const entry = document.createElement("div");
        const icon = document.createElement("span");
        const details = document.createElement("span");
        const name = document.createElement("span");
        const metadata = document.createElement("span");
        const remove = document.createElement("button");

        entry.className = "model-entry";
        icon.className = "model-icon";
        details.className = "model-details";
        name.className = "model-name";
        metadata.className = "model-meta";
        remove.className = "model-remove";

        icon.textContent = "◇";
        name.textContent = this.currentModel.name;
        metadata.textContent = `${this.currentModel.type} · ${
            formatBytes(this.currentModel.size)
        }`;
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute(
            "aria-label",
            `Remove ${this.currentModel.name}`
        );
        remove.addEventListener("click", () => this.removeCurrentModel(), {
            once: true
        });

        details.append(name, metadata);
        entry.append(icon, details, remove);
        this.modelList.append(entry);
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.importGeneration += 1;
        this.uploadButton.removeEventListener("click", this.handleUploadClick);
        this.fileInput.removeEventListener("change", this.handleFileChange);
        this.currentModel = null;
    }
}

async function validateModelFile(file) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
        throw new Error("Choose a GLB, GLTF, OBJ or FBX model.");
    }

    if (file.size === 0) {
        throw new Error("The selected model file is empty.");
    }

    if (extension === "gltf") {
        const gltf = JSON.parse(await file.text());

        if (!gltf?.asset?.version) {
            throw new Error("This GLTF file is missing its asset metadata.");
        }
    } else {
        const headerBuffer = await file.slice(0, HEADER_BYTES).arrayBuffer();
        const headerBytes = new Uint8Array(headerBuffer);

        if (extension === "glb") validateGlbHeader(headerBuffer);
        if (extension === "obj") validateObjHeader(headerBytes);
        if (extension === "fbx") validateFbxHeader(headerBytes);
    }

    return {
        name: file.name,
        size: file.size,
        type: extension.toUpperCase(),
        importedAt: Date.now()
    };
}

function validateGlbHeader(buffer) {
    if (buffer.byteLength < 12) {
        throw new Error("This GLB file has an incomplete header.");
    }

    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);

    if (magic !== 0x46546c67 || version < 2) {
        throw new Error("This is not a supported GLB 2.0 model.");
    }
}

function validateObjHeader(bytes) {
    const text = new TextDecoder().decode(bytes);

    if (!/^\s*(?:v|vn|vt|f|o|g)\s+/m.test(text)) {
        throw new Error("This OBJ file contains no recognizable geometry.");
    }
}

function validateFbxHeader(bytes) {
    const text = new TextDecoder().decode(bytes);

    if (!text.startsWith("Kaydara FBX Binary") &&
        !text.includes("FBXHeaderExtension")) {
        throw new Error("This is not a recognizable FBX model.");
    }
}

function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
