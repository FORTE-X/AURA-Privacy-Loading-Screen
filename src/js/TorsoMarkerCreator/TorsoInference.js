import * as THREE from "three";

/**
 * Converts existing landmark candidates into neutral region evidence. New
 * evidence sources can implement collect(bodyAnalysis) and be passed to
 * TorsoInference without changing the selection algorithm.
 */
export class LandmarkEvidenceSource {

    collect(bodyAnalysis) {

        return bodyAnalysis.getLandmarks().map((landmark) => {

            const role = this.getRole(landmark.type);

            return {

                source: "LandmarkDetector",
                type: landmark.type,
                sliceIndex: landmark.sliceIndex,
                supportingSlices: landmark.supportingSlices,
                role,
                weight: landmark.confidence

            };

        });

    }

    getRole(type) {

        if (
            type === "Local Minimum" ||
            type === "Contraction Region" ||
            type === "Inflection Point"
        ) {

            return "boundary";

        }

        // Maxima, plateaus, and expansion regions indicate broad central
        // structures without assigning them a predefined anatomical label.
        return "center";

    }

}

/**
 * Infers a candidate torso interval from geometric evidence only. It makes no
 * assumptions about body proportions, skeletons, or body templates.
 */
export class TorsoInference {

    constructor(bodyAnalysis, evidenceSources = [
        new LandmarkEvidenceSource()
    ]) {

        this.bodyAnalysis = bodyAnalysis;
        this.evidenceSources = evidenceSources;
        this.slices = bodyAnalysis.getSlices();

    }

    infer() {

        if (this.slices.length === 0) return null;

        const evidence = this.evidenceSources.flatMap(
            (source) => source.collect(this.bodyAnalysis)
        );
        const center = this.selectCenter(evidence);
        const start = this.selectBoundary(
            center.sliceIndex,
            -1,
            evidence
        );
        const end = this.selectBoundary(
            center.sliceIndex,
            1,
            evidence
        );
        const startSlice = Math.min(start.sliceIndex, center.sliceIndex);
        const endSlice = Math.max(end.sliceIndex, center.sliceIndex);

        return {

            startSlice,
            endSlice,
            centerSlice: center.sliceIndex,
            confidence: this.calculateConfidence(
                center,
                start,
                end,
                evidence
            ),
            supportingEvidence: [
                ...center.evidence,
                ...start.evidence,
                ...end.evidence
            ],
            boundingBox: this.createBoundingBox(startSlice, endSlice)

        };

    }

    selectCenter(evidence) {

        const centerEvidence = evidence.filter(
            (item) => item.role === "center"
        );
        const scores = this.createScores(centerEvidence);
        const bestIndex = this.findHighestScoreIndex(scores);

        if (scores[bestIndex] > 0) {

            return {

                sliceIndex: bestIndex,
                score: scores[bestIndex],
                evidence: this.getEvidenceAt(bestIndex, centerEvidence)

            };

        }

        // Degenerate scans may have no landmark candidates. Use the greatest
        // measured cross-section as a geometric fallback, with no anatomy
        // assumptions and no supporting landmark evidence.
        const areas = this.slices.map(
            (slice) => slice.crossSectionalArea
        );

        return {

            sliceIndex: this.findHighestScoreIndex(areas),
            score: 0,
            evidence: []

        };

    }

    selectBoundary(centerIndex, direction, evidence) {

        const boundaryEvidence = evidence.filter((item) =>
            item.role === "boundary" &&
            (direction < 0
                ? item.sliceIndex < centerIndex
                : item.sliceIndex > centerIndex)
        );
        const scores = this.createScores(boundaryEvidence);
        const candidateIndexes = boundaryEvidence.map(
            (item) => item.sliceIndex
        );

        if (candidateIndexes.length > 0) {

            const sliceIndex = candidateIndexes.reduce(
                (bestIndex, index) =>
                    scores[index] > scores[bestIndex] ? index : bestIndex
            );

            return {

                sliceIndex,
                score: scores[sliceIndex],
                evidence: this.getEvidenceAt(sliceIndex, boundaryEvidence)

            };

        }

        // If one side has no transition evidence, retain the scan boundary and
        // lower confidence instead of inventing a proportion-based boundary.
        return {

            sliceIndex: direction < 0 ? 0 : this.slices.length - 1,
            score: 0,
            evidence: []

        };

    }

    createScores(evidence) {

        return this.slices.map((slice, index) =>
            evidence.reduce((score, item) => {

                const supportsSlice = item.supportingSlices.includes(index);

                return score + (supportsSlice ? item.weight : 0);

            }, 0)
        );

    }

    findHighestScoreIndex(scores) {

        return scores.reduce(
            (bestIndex, score, index) =>
                score > scores[bestIndex] ? index : bestIndex,
            0
        );

    }

    getEvidenceAt(sliceIndex, evidence) {

        return evidence.filter((item) =>
            item.supportingSlices.includes(sliceIndex)
        );

    }

    calculateConfidence(center, start, end, evidence) {

        const maximumScore = Math.max(
            1,
            ...this.createScores(evidence)
        );
        const evidenceScore = (
            center.score + start.score + end.score
        ) / (3 * maximumScore);
        const neighborConsistency = this.getNeighborConsistency(
            center.sliceIndex,
            evidence
        );
        const boundaryCoverage = (
            Number(start.evidence.length > 0) +
            Number(end.evidence.length > 0)
        ) / 2;

        return Math.min(
            1,
            evidenceScore * 0.5 +
            neighborConsistency * 0.3 +
            boundaryCoverage * 0.2
        );

    }

    getNeighborConsistency(centerIndex, evidence) {

        const scores = this.createScores(evidence);
        const start = Math.max(0, centerIndex - 1);
        const end = Math.min(this.slices.length - 1, centerIndex + 1);
        const neighborhood = scores.slice(start, end + 1);
        const maximumScore = Math.max(1, ...scores);

        return neighborhood.reduce(
            (sum, score) => sum + score,
            0
        ) / (neighborhood.length * maximumScore);

    }

    createBoundingBox(startSlice, endSlice) {

        const box = new THREE.Box3();

        for (let index = startSlice; index <= endSlice; index++) {

            const slice = this.slices[index];

            box.expandByPoint(new THREE.Vector3(
                slice.minX,
                slice.minY,
                slice.minZ
            ));
            box.expandByPoint(new THREE.Vector3(
                slice.maxX,
                slice.maxY,
                slice.maxZ
            ));

        }

        return box;

    }

}
