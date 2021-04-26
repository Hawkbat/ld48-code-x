import 'phaser'
import { DEBUG, SCREEN_WIDTH, SCREEN_HEIGHT } from './constants'
import { MenuScene, GameOverScene, GameplayScene } from './scenes'


window.onerror = (msg, src, line, col, err) => {
    if (!DEBUG) {
        alert(`Please screenshot this and report it!\n\n${msg}\nin ${src}:(${line},${col})`)
    }
    console.error(err)
}


const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: '#000',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    render: {
        pixelArt: true,
    },
    scale: { mode: Phaser.Scale.ScaleModes.FIT, autoCenter: Phaser.Scale.Center.CENTER_BOTH },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: DEBUG,
        }
    },
    scene: [
        MenuScene,
        GameOverScene,
        GameplayScene,
    ],
};

const game = new Phaser.Game(config)
