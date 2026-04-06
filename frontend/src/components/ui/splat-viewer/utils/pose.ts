export type PoseType = "front" | "back" | "left" | "right" | "top" | "bottom" | "isometric";

export class Pose {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fromLookAt(_position?: any, _target?: any): this { return this; }
    rotation: any;
    constructor() {}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function computeStartingPose(_a?: any, _b?: any, _c?: any, _d?: any, _e?: any): any {
    return {
        position: [2, 1, 2],
        target: [0, 0, 0]
    };
}