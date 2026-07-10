// WS-F — see CONTRACTS.md Contract 8. The ONLY module allowed to touch postFX.
export const Juice = {
    addBloom(gameObject, opts) {},
    addCameraFX(scene) {},
    shake(scene, intensity, ms) {},
    hitFlash(sprite, color) {},
    trail(scene, sprite, colorHex) { return null; },
    burst(scene, x, y, colorHex, count) {},
    floatText(scene, x, y, str, colorHex) {}
};
