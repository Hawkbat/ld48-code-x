import { SCREEN_WIDTH, SCREEN_HEIGHT } from './constants'
import { getGameState, resetGameState } from './gamestate'
import { destroyComponent } from './helpers'

export abstract class SceneBase extends Phaser.Scene {
    loadingText!: Phaser.GameObjects.Text

    preload() {
        this.loadingText = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, '', { color: 'white', fontSize: '12px', fontFamily: 'sans-serif', align: 'center' })
        this.loadingText.setDepth(9999)
        this.loadingText.setScrollFactor(0, 0)
        this.loadingText.setOrigin(0.5, 0.5)

        this.load.on('progress', (value: number) => {
            this.loadingText.setText(`Loading...\n${Math.round(value * 100)}%`)
        })

        this.load.on('complete', () => {
            destroyComponent(this.loadingText)
        })
    }
}

export abstract class MenuSceneBase extends SceneBase {
    titleText!: Phaser.GameObjects.Text
    bodyText!: Phaser.GameObjects.Text
    continueText!: Phaser.GameObjects.Text
    creditsText!: Phaser.GameObjects.Text
    continueKey!: Phaser.Input.Keyboard.Key
    music!: Phaser.Sound.BaseSound

    preload() {
        super.preload()
        this.load.audio('music-menu', 'assets/underglow.mp3')
    }

    create() {
        this.titleText = this.add.text(SCREEN_WIDTH / 2, 100, '', { fontSize: '36px', fontStyle: 'bold' })
        this.titleText.setOrigin(0.5, 0.5)
        this.bodyText = this.add.text(100, 135, '', { fontSize: '12px', fixedWidth: SCREEN_WIDTH - 200, wordWrap: { width: SCREEN_WIDTH - 200 } })
        this.continueText = this.add.text(SCREEN_WIDTH / 2, 275, 'Press spacebar to start a new playthough')
        this.continueText.setOrigin(0.5, 0.5)
        this.creditsText = this.add.text(0, SCREEN_HEIGHT, `Code by Josh Thome (Hawkbar)\nArt by Michael Schloeder (Insmoshable)\nMusic: "Underglow", "Dire Space Emergency", and "Chipstep"\nby Shane Ivers - https://www.silvermansound.com`, { fontSize: '12px' })
        this.creditsText.setOrigin(0, 1)
        this.continueKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        this.music = this.sound.add('music-menu', { loop: true })
        this.music.play()
    }

    update() {
        if (getGameState()?.normalMusic?.isPlaying) getGameState()?.normalMusic?.stop()
        if (getGameState()?.bossMusic?.isPlaying) getGameState()?.bossMusic?.stop()
        if (this.continueKey.isDown) {
            this.music.stop()
            resetGameState()
            this.scene.start('gameplay')
        }
    }
}

export class MenuScene extends MenuSceneBase {
    logoSprite!: Phaser.GameObjects.Sprite

    constructor() { super('menu') }

    preload() {
        super.preload()
        this.load.image('logo', 'assets/Logo-Eyes.png')
    }

    create() {
        super.create()
        this.logoSprite = this.add.sprite(SCREEN_WIDTH / 2, 72, 'logo')
        this.logoSprite.setScale(2)
        this.titleText.setText('')
        this.bodyText.setText(`You are a specialized power supply drone from a deep underground military installation. Some of the other drones have gone haywire, attacking the facility's personnel. While you have no attacks of your own, you can carry and deploy other drones as long as you have their schematics and enough power to spare. Use your ability to find and destroy all the rogue supervisor drones in the lower levels of the facility before the surface is overrun!`)
    }
}

export class GameOverScene extends MenuSceneBase {
    titleText!: Phaser.GameObjects.Text

    constructor() { super('gameover') }

    create() {
        super.create()
        this.titleText.setText(getGameState().score.won ? 'Victory' : 'Game Over')

        const hours = Math.floor(getGameState().score.playTime / (60 * 60)).toString()
        const minutes = Math.floor((getGameState().score.playTime % (60 * 60)) / 60).toString().padStart(2, '0')
        const seconds = Math.floor(getGameState().score.playTime % 60).toString().padStart(2, '0')
        const time = `${hours}:${minutes}:${seconds}`

        this.bodyText.setText(`${getGameState().score.won ? 'You defeated all the rogue supervisors! The world is saved!' : 'You failed to stop the rogue supervisors. The surface was overrun by hostile robots. There were no survivors.'}\n\nEnemies Destroyed: ${getGameState().score.enemiesKilled}\nBosses Defeated: ${getGameState().score.bossesDefeated}\nFloors Cleared: ${getGameState().score.floorsCleared}\nTotal Playtime: ${time}`)
    }
}

export class GameplayScene extends SceneBase {
    text!: Phaser.GameObjects.Text

    constructor() { super('gameplay') }

    init() {

    }

    preload() {
        super.preload()

        this.load.image('placeholder', 'assets/placeholder.png')
        this.load.spritesheet('transparent', 'assets/Transparent.png', { frameWidth: 1 })
        this.load.spritesheet('drop-shadow', 'assets/DropShadow.png', { frameWidth: 32 })
        this.load.spritesheet('explosion', 'assets/Explosion.png', { frameWidth: 32 })

        this.load.image('tileset-blocks', 'assets/Test-BlockTile.png')
        this.load.image('tileset-tiles', 'assets/Test-Tiles.png')
        this.load.tilemapTiledJSON('tilemap', 'assets/Code-X.json')

        this.load.spritesheet('player', 'assets/Battery-Bot.png', { frameWidth: 32 })
        this.load.spritesheet('boss-invulnerable', 'assets/Boss.png', { frameWidth: 64 })
        this.load.spritesheet('boss-vulnerable', 'assets/Boss-Vulnerable.png', { frameWidth: 64 })

        this.load.spritesheet('drone-core', 'assets/Drone-Core.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core-hover', 'assets/Drone-Core-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core-spin', 'assets/Drone-Core-Spinning.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core-directional', 'assets/Drone-Core-Directional.png', { frameWidth: 32 })
        this.load.spritesheet('drone-gun', 'assets/Drone_Gun.png', { frameWidth: 32 })
        this.load.spritesheet('drone-tracking', 'assets/Drone-Tracking-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('drone-multishot', 'assets/Drone-Multishot-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('drone-gun-hover', 'assets/Drone_Gun-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('drone-punch-hover', 'assets/Drone-Punch-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('drone-boomerang-spin', 'assets/Drone-Boomerang.png', { frameWidth: 32 })

        this.load.spritesheet('enemy-core', 'assets/Enemy-Core-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core-hover', 'assets/Enemy-Core-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core-spin', 'assets/Enemy-Core-Spinning.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core-directional', 'assets/Enemy-Core-Directional.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-gun', 'assets/Enemy-Gun-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-multishot', 'assets/Enemy-Multishot-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-gun-hover', 'assets/Enemy-Gun-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-punch-hover', 'assets/Enemy-Punch-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-multishot-hover', 'assets/Enemy-Multishot-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-boomerang-spin', 'assets/Enemy-Boomerang.png', { frameWidth: 32 })

        this.load.spritesheet('pickup-energy', 'assets/Pickup-Energy.png', { frameWidth: 8 })
        this.load.spritesheet('pickup-schematic', 'assets/Pickup-Schematic.png', { frameWidth: 16 })
        this.load.spritesheet('pickup-key', 'assets/Elevator-Key.png', { frameWidth: 32 })

        this.load.image('interactable-power-core', 'assets/Destructable-Powercore.png')
        this.load.spritesheet('interactable-arrows', 'assets/Arrows.png', { frameWidth: 32 })

        this.load.spritesheet('pylon', 'assets/Pylons.png', { frameWidth: 32, frameHeight: 40 })

        this.load.spritesheet('projectile-ally', 'assets/Projectile-Ally.png', { frameWidth: 32 })
        this.load.spritesheet('projectile-enemy', 'assets/Projectile-Enemy.png', { frameWidth: 32 })
        this.load.spritesheet('projectile-ally-tracking', 'assets/Projectile-Ally-Tracking.png', { frameWidth: 32 })

        this.load.spritesheet('power-bar', 'assets/Power-Bar.png', { frameWidth: 32 })
        this.load.spritesheet('power-bar-large', 'assets/Power-Bar-Large.png', { frameWidth: 16 })
        this.load.spritesheet('power-bar-boss', 'assets/Power-Bar-Boss.png', { frameWidth: 16 })
        this.load.spritesheet('power-bar-player', 'assets/Power-Bar-Player.png', { frameWidth: 16 })
        this.load.spritesheet('ui-schematic-box', 'assets/UI-SelectedGun.png', { frameWidth: 32 })
        this.load.spritesheet('ui-schematic-icon', 'assets/UI-GunIcons.png', { frameWidth: 32 })

        this.load.audio('music-normal', 'assets/dire-space-emergency.mp3')
        this.load.audio('music-boss', 'assets/chipstep.mp3')
        this.load.audio('sound-bump', 'assets/bump.wav')
        this.load.audio('sound-damage', 'assets/damage.wav')
        this.load.audio('sound-shoot', 'assets/laserShoot.wav')
        this.load.audio('sound-power-up', 'assets/powerUp.wav')
        this.load.audio('sound-click', 'assets/click.wav')
        this.load.audio('sound-elevator', 'assets/elevator.wav')
        this.load.audio('sound-explosion', 'assets/explosion.wav')
    }

    create() {
        getGameState().playerGroup = this.physics.add.group()
        getGameState().droneGroup = this.physics.add.group()
        getGameState().enemyGroup = this.physics.add.group()
        getGameState().dropGroup = this.physics.add.group()
        getGameState().bulletGroup = this.physics.add.group()
        this.text = this.add.text(0, SCREEN_HEIGHT, '', { color: 'white', fontSize: '12px', fontFamily: 'sans-serif' })
        this.text.setDepth(9999)
        this.text.setScrollFactor(0, 0)
        this.text.setOrigin(0, 1)
        getGameState().normalMusic = this.sound.add('music-normal')
        getGameState().bossMusic = this.sound.add('music-boss')
        getGameState().bumpSound = this.sound.add('sound-bump')
        getGameState().damageSound = this.sound.add('sound-damage')
        getGameState().shootSound = this.sound.add('sound-shoot')
        getGameState().powerUpSound = this.sound.add('sound-power-up')
        getGameState().clickSound = this.sound.add('sound-click')
        getGameState().elevatorSound = this.sound.add('sound-elevator')
        getGameState().explosionSound = this.sound.add('sound-explosion')

        getGameState().keys = {
            w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            tab: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
        }
    }

    update(t: number, dt: number) {
        getGameState().update(this, t / 1000, dt / 1000)
        this.text.setText(`${getGameState().player.getContextTargetText()}\n(WASD/Arrow Keys) move | (Shift/Tab) cycle drones`.trim())
    }
}
