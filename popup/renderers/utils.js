
export const isCircle = hitObject => (hitObject.type & 1);
export const isSlider = hitObject => (hitObject.type & 2);
export const isNewCombo = hitObject => (hitObject.type & 4);
export const isSpinner = hitObject => (hitObject.type & 8);
export const isHold = hitObject => (hitObject.type & 128);
