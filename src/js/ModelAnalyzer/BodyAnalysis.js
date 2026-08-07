import { BodySignature } from "./BodySignature.js";
import { LandmarkDetector } from "./LandmarkDetector.js";
import { TorsoInference } from "../TorsoMarkerCreator/TorsoInference.js";
import { TorsoVolume } from "../TorsoMarkerCreator/TorsoVolume.js";
import { TorsoClassifier } from "../TorsoMarkerCreator/TorsoClassifier.js";
import { TorsoPrismClassifier } from "../TorsoMarkerCreator/TorsoPrismClassifier.js";
import { TorsoRegionRefiner } from "../TorsoMarkerCreator/TorsoRegionRefiner.js";
import { TorsoVolumeExpander } from "../TorsoMarkerCreator/TorsoVolumeExpander.js";
import { TorsoBoundsVisualizer } from "../TorsoMarkerCreator/TorsoBoundsVisualizer.js";
import { TorsoMarker } from "../TorsoMarkerCreator/TorsoMarker.js";
import { TorsoMarkerRefiner } from "../TorsoMarkerCreator/TorsoMarkerRefiner.js";

/**
 * Immutable geometry-analysis graph for one imported model. Future stages can
 * consume this single object instead of coordinating separate analysis arrays.
 */
export class BodyAnalysis {

    #slices;
    #signature;
    #landmarks;
    #metadata;

    constructor({ slices, sliceHeight, bodyBox, model }) {

        this.#slices = this.freezeSlices(slices);
        this.#metadata = this.createMetadata(
            sliceHeight,
            bodyBox
        );

        this.#signature = this.freezeSignature(new BodySignature(this));
        this.#landmarks = this.freezeLandmarks(
            new LandmarkDetector(this).detect()
        );
        this.torso = new TorsoInference(this).infer();

        if (this.torso) {

            this.torso.volume = new TorsoVolume(this).reconstruct();
            this.torso.vertexClassification = new TorsoClassifier(
                model,
                this
            ).classify();
            this.torso.prism = new TorsoPrismClassifier(
                model,
                this
            ).classify();
            this.torso.refinedVertexClassification = new TorsoRegionRefiner(
                model,
                this
            ).refine();
            const expansion = new TorsoVolumeExpander(model, this).expand();

            this.torso.synchronizedVolume = expansion.synchronizedVolume;
            this.torso.expandedVolume = expansion.expandedVolume;
            this.torso.expandedVertexClassification =
                expansion.expandedVertexClassification;
            this.torso.expansionStatistics = expansion.statistics;

            this.torso.bounds = TorsoBoundsVisualizer.calculate(model, this);
            this.torso.refinedMarkerBounds = TorsoMarkerRefiner.refine(
                this.torso.bounds.box
            );
            this.torso.marker = this.createTorsoMarker(this.torso);

        }

        this.torso = this.freezeTorso(this.torso);

        Object.freeze(this);

    }

    getSlices() {

        return this.#slices;

    }

    getSignature() {

        return this.#signature;

    }

    getLandmarks() {

        return this.#landmarks;

    }

    getMetadata() {

        // Return a clone so callers cannot mutate the stored bounds.
        return {

            ...this.#metadata,
            modelBounds: this.#metadata.modelBounds.clone()

        };

    }

    getTorso() {

        return this.torso;

    }

    freezeSlices(slices) {

        return Object.freeze(slices.map((slice) => {

            Object.freeze(slice.center);

            return Object.freeze(slice);

        }));

    }

    createMetadata(sliceHeight, bodyBox) {

        const modelBounds = bodyBox.clone();

        Object.freeze(modelBounds.min);
        Object.freeze(modelBounds.max);
        Object.freeze(modelBounds);

        return Object.freeze({

            sliceCount: this.#slices.length,
            sliceHeight,
            modelBounds,
            timestamp: new Date().toISOString()

        });

    }

    freezeSignature(signature) {

        signature.measurements.forEach((measurement) => {

            Object.freeze(measurement);

        });

        Object.freeze(signature.measurements);

        return Object.freeze(signature);

    }

    freezeLandmarks(landmarks) {

        return Object.freeze(landmarks.map((landmark) => {

            Object.freeze(landmark.supportingSlices);

            return Object.freeze(landmark);

        }));

    }

    freezeTorso(torso) {

        if (!torso) return null;

        Object.freeze(torso.boundingBox.min);
        Object.freeze(torso.boundingBox.max);
        Object.freeze(torso.boundingBox);
        this.freezeVolume(torso.volume);
        this.freezeVertexClassification(torso.vertexClassification);
        this.freezeClassification(torso.refinedVertexClassification);
        this.freezeClassification(torso.expandedVertexClassification);
        this.freezeProfileVolume(torso.synchronizedVolume);
        this.freezeProfileVolume(torso.expandedVolume);
        Object.freeze(torso.expansionStatistics);
        this.freezeBounds(torso.bounds);
        this.freezeRefinedMarkerBounds(torso.refinedMarkerBounds);
        this.freezePrism(torso.prism);
        torso.supportingEvidence.forEach((evidence) => {

            Object.freeze(evidence);

        });
        Object.freeze(torso.supportingEvidence);

        return Object.freeze(torso);

    }

    createTorsoMarker(torso) {

        const refinedBounds = torso.refinedMarkerBounds?.box;
        const candidate = TorsoMarker.isValidBox(refinedBounds)
            ? { source: "shortened torso marker", bounds: refinedBounds }
            : TorsoMarker.resolveBounds(torso);

        return candidate
            ? new TorsoMarker(candidate.bounds, candidate.source)
            : null;

    }

    freezeVolume(volume) {

        if (!volume) return;

        volume.slices.forEach((slice) => {

            Object.freeze(slice.center);
            Object.freeze(slice);

        });
        volume.centerLine.forEach((point) => Object.freeze(point));
        Object.freeze(volume.slices);
        Object.freeze(volume.centerLine);
        Object.freeze(volume.overallBounds.min);
        Object.freeze(volume.overallBounds.max);
        Object.freeze(volume.overallBounds);
        Object.freeze(volume);

    }

    freezeVertexClassification(classification) {

        this.freezeClassification(classification);

    }

    freezeClassification(classification) {

        classification.meshes.forEach((mesh) => Object.freeze(mesh));
        Object.freeze(classification.meshes);
        if (classification.statistics.baseline) {

            Object.freeze(classification.statistics.baseline);

        }
        Object.freeze(classification.statistics);
        Object.freeze(classification);

    }

    freezeProfileVolume(volume) {

        volume.profiles.forEach((profile) => Object.freeze(profile));
        Object.freeze(volume.profiles);
        Object.freeze(volume.bounds.min);
        Object.freeze(volume.bounds.max);
        Object.freeze(volume.bounds);
        Object.freeze(volume);

    }

    freezeBounds(bounds) {

        if (!bounds) return;

        Object.freeze(bounds.box.min);
        Object.freeze(bounds.box.max);
        Object.freeze(bounds.box);
        Object.freeze(bounds.center);
        Object.freeze(bounds.size);
        Object.freeze(bounds.min);
        Object.freeze(bounds.max);
        Object.freeze(bounds);

    }

    freezeRefinedMarkerBounds(bounds) {

        if (!bounds) return;

        Object.freeze(bounds.box.min);
        Object.freeze(bounds.box.max);
        Object.freeze(bounds.box);
        Object.freeze(bounds.min);
        Object.freeze(bounds.max);
        Object.freeze(bounds.center);
        Object.freeze(bounds.size);
        Object.freeze(bounds.originalBounds.min);
        Object.freeze(bounds.originalBounds.max);
        Object.freeze(bounds.originalBounds);
        Object.freeze(bounds);

    }

    freezePrism(prism) {

        Object.freeze(prism.anchors.upperLeft);
        Object.freeze(prism.anchors.upperRight);
        Object.freeze(prism.anchors.lowerCenter);
        Object.freeze(prism.anchors);
        Object.freeze(prism.coreTriangle.upperLeft);
        Object.freeze(prism.coreTriangle.upperRight);
        Object.freeze(prism.coreTriangle.lowerCenter);
        Object.freeze(prism.coreTriangle);
        Object.freeze(prism.expandedTriangle.upperLeft);
        Object.freeze(prism.expandedTriangle.upperRight);
        Object.freeze(prism.expandedTriangle.lowerCenter);
        Object.freeze(prism.expandedTriangle);
        this.freezeClassification(prism.prismClassification);
        Object.freeze(prism.depthBounds);
        Object.freeze(prism.statistics);
        Object.freeze(prism);

    }

}
