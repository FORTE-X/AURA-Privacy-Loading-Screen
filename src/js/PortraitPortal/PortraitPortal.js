import * as THREE from "three";

export const PORTAL_COLOR = 0xe36cff;
export const PORTAL_RIPPLE_COUNT = 4;
export const PORTAL_RIPPLE_SPEED = 0.32;
export const PORTAL_RADIUS_WIDTH_RATIO = 0.62;
export const PORTAL_GLOW_HEIGHT_RATIO = 0.38;
export const PORTAL_RIPPLE_OPACITY = 0.1;
export const PORTAL_UPWARD_GLOW_OPACITY = 0.34;

export class PortraitPortal {

    constructor(bounds, cutoffY) {

        if (!bounds || bounds.isEmpty() || !Number.isFinite(cutoffY)) {
            throw new Error("Portrait portal requires valid model bounds and cutoff.");
        }

        this.bounds = bounds.clone();
        this.cutoffY = cutoffY;
        this.group = new THREE.Group();
        this.group.name = "Portrait Portal";
        this.ripples = [];
        this.materials = [];
        this.geometries = [];
        this.textures = [];
        this.disposed = false;

        this.build();

    }

    get object3D() {

        return this.group;

    }

    build() {

        const size = this.bounds.getSize(new THREE.Vector3());
        const center = this.bounds.getCenter(new THREE.Vector3());
        const minimumRadius = size.y * 0.16;
        const maximumRadius = size.y * 0.28;
        const radius = THREE.MathUtils.clamp(
            size.x * PORTAL_RADIUS_WIDTH_RATIO,
            minimumRadius,
            maximumRadius
        );

        this.radius = radius;
        this.group.position.set(center.x, this.cutoffY + size.y * 0.003, center.z);

        this.addCoreGlow(radius);
        this.addRipples(radius);
        this.addUpwardGlow(
            radius,
            size.y * PORTAL_GLOW_HEIGHT_RATIO,
            size.z
        );

    }

    addCoreGlow(radius) {

        const diskTexture = createSoftDiskTexture();
        const diskGeometry = new THREE.PlaneGeometry(radius * 2.15, radius * 2.15);
        const diskMaterial = createGlowMaterial(0.065, 1.1, diskTexture);
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);

        disk.name = "Portal Soft Disk";
        disk.rotation.x = -Math.PI / 2;
        disk.scale.y = 0.68;
        disk.renderOrder = 2;
        this.group.add(disk);
        this.geometries.push(diskGeometry);
        this.materials.push(diskMaterial);
        this.textures.push(diskTexture);

        const ringTexture = createSoftRingTexture();
        const coreGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
        const coreMaterial = createGlowMaterial(0.2, 1.75, ringTexture);
        const coreRing = new THREE.Mesh(coreGeometry, coreMaterial);

        coreRing.name = "Portal Core Ring";
        coreRing.rotation.x = -Math.PI / 2;
        coreRing.scale.y = 0.68;
        coreRing.renderOrder = 4;
        this.group.add(coreRing);
        this.coreRing = coreRing;
        this.geometries.push(coreGeometry);
        this.materials.push(coreMaterial);
        this.textures.push(ringTexture);

    }

    addRipples(radius) {

        for (let index = 0; index < PORTAL_RIPPLE_COUNT; index++) {

            const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
            const material = createGlowMaterial(
                PORTAL_RIPPLE_OPACITY,
                1.75,
                this.coreRing.material.map
            );
            const mesh = new THREE.Mesh(geometry, material);

            mesh.name = `Portal Ripple ${index + 1}`;
            mesh.rotation.x = -Math.PI / 2;
            mesh.renderOrder = 3;
            this.group.add(mesh);
            this.ripples.push({
                mesh,
                material,
                phaseOffset: index / PORTAL_RIPPLE_COUNT
            });
            this.geometries.push(geometry);
            this.materials.push(material);

        }

    }

    addUpwardGlow(radius, height, modelDepth) {

        const texture = createVerticalGlowTexture();
        const auraColor = new THREE.Color();

        auraColor.setRGB(1.65, 0.42, 2.0);

        const material = new THREE.SpriteMaterial({
            color: auraColor,
            map: texture,
            transparent: true,
            opacity: PORTAL_UPWARD_GLOW_OPACITY,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const glow = new THREE.Sprite(material);

        glow.name = "Portal Upward Glow";
        glow.position.y = height * 0.7;
        glow.position.z = -modelDepth * 0.62;
        glow.scale.set(radius * 2.45, height * 1.65, 1);
        glow.renderOrder = 1;
        this.group.add(glow);
        this.upwardGlow = glow;
        this.materials.push(material);
        this.textures.push(texture);

        const beamMaterial = material.clone();
        const beam = new THREE.Sprite(beamMaterial);

        beam.name = "Portal Rising Beam";
        beam.position.set(0, height * 0.86, -modelDepth * 0.6);
        beam.scale.set(radius * 1.05, height * 1.95, 1);
        beam.material.opacity = PORTAL_UPWARD_GLOW_OPACITY * 0.34;
        beam.renderOrder = 1;
        this.group.add(beam);
        this.upwardBeam = beam;
        this.materials.push(beamMaterial);

    }

    update(_deltaTime, elapsedTime) {

        if (this.disposed || !this.group.visible) return;

        this.ripples.forEach((ripple) => {

            const progress = (
                elapsedTime * PORTAL_RIPPLE_SPEED + ripple.phaseOffset
            ) % 1;
            const scale = 0.92 + progress * 0.72;
            const fade = 1 - progress;

            ripple.mesh.scale.set(scale, scale * 0.68, 1);
            ripple.mesh.position.y = progress * 0.008;
            ripple.material.opacity = fade * fade * PORTAL_RIPPLE_OPACITY;

        });

        const pulse = 0.5 + Math.sin(elapsedTime * 1.8) * 0.5;

        const coreScale = 0.985 + pulse * 0.025;

        this.coreRing.material.opacity = 0.15 + pulse * 0.05;
        this.coreRing.scale.set(coreScale, coreScale * 0.68, 1);
        this.upwardGlow.material.opacity =
            PORTAL_UPWARD_GLOW_OPACITY * (0.84 + pulse * 0.16);
        this.upwardBeam.material.opacity =
            PORTAL_UPWARD_GLOW_OPACITY * (0.24 + pulse * 0.12);

    }

    show() {

        this.group.visible = true;

    }

    hide() {

        this.group.visible = false;

    }

    dispose() {

        if (this.disposed) return;

        this.disposed = true;
        this.group.removeFromParent();
        this.geometries.forEach((geometry) => geometry.dispose());
        this.materials.forEach((material) => material.dispose());
        this.textures.forEach((texture) => texture.dispose());
        this.ripples.length = 0;
        this.geometries.length = 0;
        this.materials.length = 0;
        this.textures.length = 0;
        this.group.clear();

    }

}

function createGlowMaterial(opacity, brightness = 1.5, map = null) {

    const color = new THREE.Color();

    color.setRGB(1.0 * brightness, 0.18 * brightness, 1.2 * brightness);

    return new THREE.MeshBasicMaterial({
        color,
        map,
        transparent: true,
        opacity,
        alphaTest: map ? 0.006 : 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
    });

}

function createSoftDiskTexture() {

    const canvas = createTextureCanvas(256);
    const context = canvas.getContext("2d");
    const center = canvas.width * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    gradient.addColorStop(0.38, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(0.72, "rgba(255, 255, 255, 0.07)");
    gradient.addColorStop(0.9, "rgba(255, 255, 255, 0.015)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return createCanvasTexture(canvas);

}

function createSoftRingTexture() {

    const canvas = createTextureCanvas(256);
    const context = canvas.getContext("2d");
    const center = canvas.width * 0.5;
    const gradient = context.createRadialGradient(
        center,
        center,
        center * 0.56,
        center,
        center,
        center
    );

    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.47, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.08)");
    gradient.addColorStop(0.69, "rgba(255, 255, 255, 0.5)");
    gradient.addColorStop(0.74, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.79, "rgba(255, 255, 255, 0.46)");
    gradient.addColorStop(0.88, "rgba(255, 255, 255, 0.06)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return createCanvasTexture(canvas);

}

function createVerticalGlowTexture() {

    const canvas = document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 512;

    const context = canvas.getContext("2d");
    const image = context.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {

        const vertical = y / (canvas.height - 1);
        const beamWidth = 0.1 + vertical * 0.72;

        for (let x = 0; x < canvas.width; x++) {

            const horizontal = Math.abs(
                (x / (canvas.width - 1) - 0.5) * 2
            );
            const beamDistance = horizontal / beamWidth;
            const beam = beamDistance < 1
                ? Math.pow(1 - beamDistance, 2.35) * Math.pow(vertical, 1.35)
                : 0;
            const baseDistance = Math.sqrt(
                Math.pow(horizontal / 0.92, 2) +
                Math.pow((1 - vertical) / 0.28, 2)
            );
            const base = baseDistance < 1
                ? Math.pow(1 - baseDistance, 2.2)
                : 0;
            const alpha = Math.min(1, beam * 0.78 + base * 0.62);
            const offset = (y * canvas.width + x) * 4;

            image.data[offset] = 255;
            image.data[offset + 1] = 255;
            image.data[offset + 2] = 255;
            image.data[offset + 3] = Math.round(alpha * 255);

        }

    }

    context.putImageData(image, 0, 0);

    return createCanvasTexture(canvas);

}

function createTextureCanvas(size) {

    const canvas = document.createElement("canvas");

    canvas.width = size;
    canvas.height = size;

    return canvas;

}

function createCanvasTexture(canvas) {

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return texture;

}
