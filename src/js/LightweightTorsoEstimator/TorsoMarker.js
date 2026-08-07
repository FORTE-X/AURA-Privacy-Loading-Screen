import * as THREE from "three";
import { TorsoSpiral } from "./TorsoSpiral.js";
import { BodyLandmarks } from "./BodyLandmarks.js";

const MARKER_COLOR = 0xff75b5;

export class TorsoMarker {

    constructor(estimation, visible = false) {

        if (!estimation?.bounds || estimation.bounds.isEmpty()) {

            throw new Error("A valid torso estimation is required.");

        }

        this.estimation = estimation;
        this.bounds = estimation.bounds.clone();
        this.group = new THREE.Group();
        this.group.name = "Lightweight Torso Marker";
        this.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        this.material = new THREE.LineBasicMaterial({
            color: MARKER_COLOR,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });
        this.lines = new THREE.LineSegments(this.geometry, this.material);
        this.lines.name = "Torso Marker Bounds";
        this.lines.renderOrder = 1000;
        this.spiral = new TorsoSpiral(estimation);
        this.landmarks = new BodyLandmarks(estimation);

        const center = this.bounds.getCenter(new THREE.Vector3());
        const size = this.bounds.getSize(new THREE.Vector3());

        this.lines.position.copy(center);
        this.lines.scale.copy(size);
        this.group.add(this.lines);
        this.group.add(this.spiral.object3D);
        this.group.add(this.landmarks.object3D);
        this.group.visible = visible;

    }

    get object3D() {

        return this.group;

    }

    show() {

        this.group.visible = true;

    }

    hide() {

        this.group.visible = false;

    }

    toggle() {

        this.group.visible = !this.group.visible;

        return this.group.visible;

    }

    get visible() {

        return this.group.visible;

    }

    dispose() {

        this.group.removeFromParent();
        this.landmarks.dispose();
        this.spiral.dispose();
        this.geometry.dispose();
        this.material.dispose();
        this.group.clear();

    }

}
