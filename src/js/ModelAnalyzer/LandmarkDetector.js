// Tune these values for the scan unit and level of detail in imported models.
export const MINIMUM_PROMINENCE = 0.0005;
export const MINIMUM_PLATEAU_LENGTH = 3;
export const LANDMARK_SMOOTHING_WINDOW = 2;

/**
 * Finds geometric changes in a BodySignature without assigning anatomical
 * meaning to them. All candidates are based solely on measured slice area.
 */
export class LandmarkDetector {

    constructor(bodyAnalysis) {

        this.measurements = bodyAnalysis.getSignature().measurements;
        this.smoothedAreas = this.smoothAreas();

    }

    detect() {

        if (this.measurements.length === 0) return [];

        return [
            ...this.findLocalExtrema(),
            ...this.findPlateaus(),
            ...this.findTrendRegions("Growing", "Expansion Region"),
            ...this.findTrendRegions("Shrinking", "Contraction Region"),
            ...this.findInflectionPoints()
        ];

    }

    smoothAreas() {

        const areas = this.measurements.map(
            (measurement) => measurement.slice.crossSectionalArea
        );
        const sums = [0];

        areas.forEach((area) => {

            sums.push(sums[sums.length - 1] + area);

        });

        return areas.map((area, index) => {

            const start = Math.max(0, index - LANDMARK_SMOOTHING_WINDOW);
            const end = Math.min(
                areas.length - 1,
                index + LANDMARK_SMOOTHING_WINDOW
            );

            return (sums[end + 1] - sums[start]) / (end - start + 1);

        });

    }

    findLocalExtrema() {

        const landmarks = [];

        for (let index = 1; index < this.smoothedAreas.length - 1; index++) {

            const previous = this.smoothedAreas[index - 1];
            const current = this.smoothedAreas[index];
            const next = this.smoothedAreas[index + 1];

            const maximumProminence = current - Math.max(previous, next);
            const minimumProminence = Math.min(previous, next) - current;

            if (maximumProminence >= MINIMUM_PROMINENCE) {

                landmarks.push(this.createLandmark(
                    index,
                    "Local Maximum",
                    [index - 1, index, index + 1],
                    maximumProminence
                ));

            }

            if (minimumProminence >= MINIMUM_PROMINENCE) {

                landmarks.push(this.createLandmark(
                    index,
                    "Local Minimum",
                    [index - 1, index, index + 1],
                    minimumProminence
                ));

            }

        }

        return landmarks;

    }

    findPlateaus() {

        const landmarks = [];
        let start = 0;

        while (start < this.smoothedAreas.length) {

            let end = start;

            while (
                end + 1 < this.smoothedAreas.length &&
                Math.abs(
                    this.smoothedAreas[end + 1] - this.smoothedAreas[end]
                ) < MINIMUM_PROMINENCE
            ) {

                end++;

            }

            const length = end - start + 1;

            if (length >= MINIMUM_PLATEAU_LENGTH) {

                const centerIndex = Math.floor((start + end) / 2);
                const supportingSlices = this.createSliceRange(start, end);
                const boundaryChange = this.getPlateauBoundaryChange(start, end);

                landmarks.push(this.createLandmark(
                    centerIndex,
                    "Plateau Region",
                    supportingSlices,
                    boundaryChange
                ));

            }

            start = end + 1;

        }

        return landmarks;

    }

    findTrendRegions(trend, type) {

        const landmarks = [];
        let start = null;

        this.measurements.forEach((measurement, index) => {

            if (measurement.trend === trend && start === null) start = index;

            const isEndOfRegion =
                start !== null &&
                (measurement.trend !== trend ||
                index === this.measurements.length - 1);

            if (!isEndOfRegion) return;

            const end = measurement.trend === trend ? index : index - 1;
            const supportingSlices = this.createSliceRange(start, end);
            const centerIndex = Math.floor((start + end) / 2);
            const change = Math.abs(
                this.smoothedAreas[end] - this.smoothedAreas[start]
            );

            landmarks.push(this.createLandmark(
                centerIndex,
                type,
                supportingSlices,
                change
            ));

            start = null;

        });

        return landmarks;

    }

    findInflectionPoints() {

        const landmarks = [];
        let previousTrend = null;
        let previousIndex = null;

        this.measurements.forEach((measurement, index) => {

            if (measurement.trend === "Stable") return;

            if (
                previousTrend &&
                previousTrend !== measurement.trend
            ) {

                const supportingSlices = [previousIndex, index];
                const change =
                    Math.abs(this.smoothedAreas[index] -
                        this.smoothedAreas[previousIndex]);

                landmarks.push(this.createLandmark(
                    index,
                    "Inflection Point",
                    supportingSlices,
                    change
                ));

            }

            previousTrend = measurement.trend;
            previousIndex = index;

        });

        return landmarks;

    }

    createLandmark(sliceIndex, type, supportingSlices, strength) {

        return {

            sliceIndex,
            y: this.measurements[sliceIndex].slice.center.y,
            type,
            confidence: this.calculateConfidence(
                supportingSlices,
                strength
            ),
            supportingSlices

        };

    }

    calculateConfidence(supportingSlices, strength) {

        const start = supportingSlices[0];
        const end = supportingSlices[supportingSlices.length - 1];
        const contextStart = Math.max(0, start - LANDMARK_SMOOTHING_WINDOW);
        const contextEnd = Math.min(
            this.smoothedAreas.length - 1,
            end + LANDMARK_SMOOTHING_WINDOW
        );
        const context = this.smoothedAreas.slice(
            contextStart,
            contextEnd + 1
        );
        const contextAverage = context.reduce(
            (sum, area) => sum + area,
            0
        ) / context.length;
        const contextNoise = context.reduce(
            (sum, area) => sum + Math.abs(area - contextAverage),
            0
        ) / context.length;

        // Stronger features surrounded by less variation are more reliable.
        return Math.min(
            1,
            strength / (strength + contextNoise + MINIMUM_PROMINENCE)
        );

    }

    getPlateauBoundaryChange(start, end) {

        const before = this.smoothedAreas[start - 1];
        const after = this.smoothedAreas[end + 1];
        const plateauArea = this.smoothedAreas[
            Math.floor((start + end) / 2)
        ];

        return Math.max(
            Math.abs((before ?? plateauArea) - plateauArea),
            Math.abs((after ?? plateauArea) - plateauArea)
        );

    }

    createSliceRange(start, end) {

        return Array.from(
            { length: end - start + 1 },
            (value, index) => start + index
        );

    }

}
