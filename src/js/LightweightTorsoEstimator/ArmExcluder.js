export const MAX_TORSO_WIDTH_TO_HEIGHT = 0.34;
export const MIN_ARM_GAP_TO_HEIGHT = 0.012;

const MIN_SAMPLES = 4;
const GAP_MULTIPLIER = 8;

/**
 * Keeps the central body component of one horizontal slice. A proportional
 * width corridor removes distant T/A-pose arms, while large X gaps separate
 * arms that remain near the torso.
 */
export function excludeArmsFromSlice(
    xValues,
    zValues,
    bodyCenterX,
    bodyHeight
) {

    const halfMaximumWidth =
        bodyHeight * MAX_TORSO_WIDTH_TO_HEIGHT * 0.5;
    const samples = [];

    for (let index = 0; index < xValues.length; index++) {

        if (Math.abs(xValues[index] - bodyCenterX) > halfMaximumWidth) {

            continue;

        }

        samples.push({ x: xValues[index], z: zValues[index] });

    }

    if (samples.length < MIN_SAMPLES) {

        return { x: xValues.slice(), z: zValues.slice(), excludedCount: 0 };

    }

    samples.sort((a, b) => a.x - b.x);

    const positiveGaps = [];

    for (let index = 1; index < samples.length; index++) {

        const gap = samples[index].x - samples[index - 1].x;

        if (gap > Number.EPSILON) positiveGaps.push(gap);

    }

    positiveGaps.sort((a, b) => a - b);

    const medianGap = positiveGaps.length
        ? positiveGaps[Math.floor(positiveGaps.length * 0.5)]
        : 0;
    const separationThreshold = Math.max(
        bodyHeight * MIN_ARM_GAP_TO_HEIGHT,
        medianGap * GAP_MULTIPLIER
    );
    const components = [];
    let componentStart = 0;

    for (let index = 1; index < samples.length; index++) {

        if (samples[index].x - samples[index - 1].x <= separationThreshold) {

            continue;

        }

        components.push(samples.slice(componentStart, index));
        componentStart = index;

    }

    components.push(samples.slice(componentStart));

    const usableComponents = components.filter(
        (component) => component.length >= MIN_SAMPLES
    );
    const centralComponent = usableComponents.slice(1).reduce(
        (best, component) => {

        const center =
            (component[0].x + component[component.length - 1].x) * 0.5;
        const score = Math.abs(center - bodyCenterX);
        const bestCenter =
            (best[0].x + best[best.length - 1].x) * 0.5;
        const bestScore = Math.abs(bestCenter - bodyCenterX);

        if (score < bestScore) return component;

        // Prefer the denser component when both are equally central.
        return Math.abs(score - bestScore) <= Number.EPSILON &&
            component.length > best.length
            ? component
            : best;

    }, usableComponents[0] ?? samples);

    return {
        x: centralComponent.map((sample) => sample.x),
        z: centralComponent.map((sample) => sample.z),
        excludedCount: xValues.length - centralComponent.length
    };

}
