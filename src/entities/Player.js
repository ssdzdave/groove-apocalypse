// WS-C — see CONTRACTS.md Contract 5.
export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, charId) { super(scene, x, y, 'char_' + charId); throw new Error('WS-C: Player not implemented'); }
}
