/**
 * Shared viewer interaction state. Camera vectors stored here are clones so
 * restoring a view never depends on mutable Three.js object references.
 */
export const viewerState = {

    defaultView: null,
    savedView: null

};
