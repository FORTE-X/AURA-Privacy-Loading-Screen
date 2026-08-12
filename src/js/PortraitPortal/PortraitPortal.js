import * as THREE from "three";

export const PORTAL_COLOR = 0xe36cff;
export const PORTAL_RIPPLE_COUNT = 4;
export const PORTAL_RIPPLE_SPEED = 0.32;
export const PORTAL_RADIUS_WIDTH_RATIO = 0.62;
export const PORTAL_GLOW_HEIGHT_RATIO = 0.28;

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

        const diskGeometry = new THREE.CircleGeometry(radius * 0.94, 128);
        const diskMaterial = createGlowMaterial(0.035);
        const disk = new THREE.Mesh(diskGeometry, diskMaterial);

        disk.name = "Portal Soft Disk";
        disk.rotation.x = -Math.PI / 2;
        disk.scale.z = 0.7;
        disk.renderOrder = 2;
        this.group.add(disk);
        this.geometries.push(diskGeometry);
        this.materials.push(diskMaterial);

        const coreGeometry = new THREE.RingGeometry(
            radius * 0.76,
            radius * 0.79,
            160
        );
        const coreMaterial = createGlowMaterial(0.72, 3.2);
        const coreRing = new THREE.Mesh(coreGeometry, coreMaterial);

        coreRing.name = "Portal Core Ring";
        coreRing.rotation.x = -Math.PI / 2;
        coreRing.scale.z = 0.7;
        coreRing.renderOrder = 4;
        this.group.add(coreRing);
        this.coreRing = coreRing;
        this.geometries.push(coreGeometry);
        this.materials.push(coreMaterial);

    }

    addRipples(radius) {

        for (let index = 0; index < PORTAL_RIPPLE_COUNT; index++) {

            const geometry = new THREE.RingGeometry(
                radius * 0.78,
                radius * 0.795,
                160
            );
            const material = createGlowMaterial(0.42, 2.1);
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
        const geometry = new THREE.PlaneGeometry(radius * 2.25, height, 1, 1);
        const auraColor = new THREE.Color();

        auraColor.setRGB(1.8, 0.55, 2.2);

        const material = new THREE.MeshBasicMaterial({
            color: auraColor,
            map: texture,
            transparent: true,
            opacity: 0.46,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
        });
        const glow = new THREE.Mesh(geometry, material);

        glow.name = "Portal Upward Glow";
        glow.position.y = height * 0.5;
        glow.position.z = -modelDepth * 0.58;
        glow.renderOrder = 1;
        this.group.add(glow);
        this.upwardGlow = glow;
        this.geometries.push(geometry);
        this.materials.push(material);
        this.textures.push(texture);

    }

    update(_deltaTime, elapsedTime) {

        if (this.disposed || !this.group.visible) return;

        this.ripples.forEach((ripple) => {

            const progress = (
                elapsedTime * PORTAL_RIPPLE_SPEED + ripple.phaseOffset
            ) % 1;
            const scale = 0.92 + progress * 0.72;
            const fade = 1 - progress;

            ripple.mesh.scale.set(scale, scale, scale * 0.7);
            ripple.mesh.position.y = progress * 0.008;
            ripple.material.opacity = fade * fade * 0.46;

        });

        const pulse = 0.5 + Math.sin(elapsedTime * 1.8) * 0.5;

        this.coreRing.material.opacity = 0.58 + pulse * 0.18;
        this.coreRing.scale.setScalar(0.985 + pulse * 0.025);
        this.upwardGlow.material.opacity = 0.34 + pulse * 0.12;

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

function createGlowMaterial(opacity, brightness = 1.5) {

    const color = new THREE.Color();

    color.setRGB(1.0 * brightness, 0.18 * brightness, 1.2 * brightness);

    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
    });

}

function createVerticalGlowTexture() {

    const canvas = document.createElement("canvas");

    canvas.width = 128;
    canvas.height = 256;

    const context = canvas.getContext("2d");
    const radial = context.createRadialGradient(
        canvas.width * 0.5,
        canvas.height,
        0,
        canvas.width * 0.5,
        canvas.height,
        canvas.height * 0.78
    );

    radial.addColorStop(0, "rgba(255, 100, 255, 0.88)");
    radial.addColorStop(0.22, "rgba(224, 79, 255, 0.48)");
    radial.addColorStop(0.56, "rgba(142, 42, 220, 0.12)");
    radial.addColorStop(1, "rgba(82, 22, 150, 0)");
    context.fillStyle = radial;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalCompositeOperation = "destination-in";

    const horizontalMask = context.createLinearGradient(0, 0, canvas.width, 0);

    horizontalMask.addColorStop(0, "rgba(255, 255, 255, 0)");
    horizontalMask.addColorStop(0.24, "rgba(255, 255, 255, 0.72)");
    horizontalMask.addColorStop(0.5, "rgba(255, 255, 255, 1)");
    horizontalMask.addColorStop(0.76, "rgba(255, 255, 255, 0.72)");
    horizontalMask.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = horizontalMask;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const verticalMask = context.createLinearGradient(0, 0, 0, canvas.height);

    verticalMask.addColorStop(0, "rgba(255, 255, 255, 0)");
    verticalMask.addColorStop(0.34, "rgba(255, 255, 255, 0.38)");
    verticalMask.addColorStop(1, "rgba(255, 255, 255, 1)");
    context.fillStyle = verticalMask;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    return texture;

}
