// Tune these values for the scan unit used by imported models.
export const MOVING_AVERAGE_RADIUS = 1;
export const WIDTH_CHANGE_THRESHOLD = 0.005;
export const DEPTH_CHANGE_THRESHOLD = 0.005;
export const AREA_CHANGE_THRESHOLD = 0.0001;
export const TREND_SCORE_THRESHOLD = 1;

/**
 * Describes how a body's measured cross-sections change from bottom to top.
 * This class consumes Slice data only; it does not inspect or alter the model.
 */
export class BodySignature {

    constructor(bodyAnalysis) {

        this.measurements = this.createMeasurements(
            bodyAnalysis.getSlices()
        );

    }

    createMeasurements(slices) {

        const averages = this.calculateMovingAverages(slices);

        return slices.map((slice, index) => {

            const previousSlice = slices[index - 1];
            const previousAverage = averages[index - 1];
            const average = averages[index];

            const widthChange = previousSlice
                ? slice.width - previousSlice.width
                : 0;
            const depthChange = previousSlice
                ? slice.depth - previousSlice.depth
                : 0;
            const areaChange = previousSlice
                ? slice.crossSectionalArea - previousSlice.crossSectionalArea
                : 0;

            const smoothedWidthChange = previousAverage
                ? average.width - previousAverage.width
                : 0;
            const smoothedDepthChange = previousAverage
                ? average.depth - previousAverage.depth
                : 0;
            const smoothedAreaChange = previousAverage
                ? average.area - previousAverage.area
                : 0;

            return {

                slice,
                widthChange,
                depthChange,
                areaChange,
                averageWidth: average.width,
                averageDepth: average.depth,
                averageArea: average.area,
                smoothedWidthChange,
                smoothedDepthChange,
                smoothedAreaChange,
                trend: this.classifyTrend(
                    smoothedWidthChange,
                    smoothedDepthChange,
                    smoothedAreaChange
                )

            };

        });

    }

    calculateMovingAverages(slices) {

        const widthSums = this.createPrefixSums(slices, "width");
        const depthSums = this.createPrefixSums(slices, "depth");
        const areaSums = this.createPrefixSums(
            slices,
            "crossSectionalArea"
        );

        return slices.map((slice, index) => {

            const start = Math.max(0, index - MOVING_AVERAGE_RADIUS);
            const end = Math.min(
                slices.length - 1,
                index + MOVING_AVERAGE_RADIUS
            );
            const count = end - start + 1;

            return {

                width: (widthSums[end + 1] - widthSums[start]) / count,
                depth: (depthSums[end + 1] - depthSums[start]) / count,
                area: (areaSums[end + 1] - areaSums[start]) / count

            };

        });

    }

    createPrefixSums(slices, property) {

        const sums = [0];

        slices.forEach((slice) => {

            sums.push(sums[sums.length - 1] + slice[property]);

        });

        return sums;

    }

    classifyTrend(widthChange, depthChange, areaChange) {

        const score =
            widthChange / WIDTH_CHANGE_THRESHOLD +
            depthChange / DEPTH_CHANGE_THRESHOLD +
            areaChange / AREA_CHANGE_THRESHOLD;

        if (score >= TREND_SCORE_THRESHOLD) return "Growing";
        if (score <= -TREND_SCORE_THRESHOLD) return "Shrinking";

        return "Stable";

    }

}
