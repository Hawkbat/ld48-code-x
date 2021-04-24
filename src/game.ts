import 'phaser'

export abstract class EntityBase {
    sprite: Phaser.GameObjects.Sprite

    scene: Phaser.Scene
    x: number
    y: number
    power: number
    maxPower: number

    get body() { return this.sprite.body as Phaser.Physics.Arcade.Body }

    addToScene(scene: Phaser.Scene) {
        this.scene = scene
        if (this.sprite) {
            this.sprite.destroy()
        }
    }

    update(t: number, dt: number) {

    }
}

export class Player extends EntityBase {
    sprite: Phaser.GameObjects.Sprite

    addToScene(scene: Phaser.Scene) {
        super.addToScene(scene)
        this.sprite = scene.physics.add.sprite(this.x, this.y, 'placeholder', 0)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        const cursors = this.scene.input.keyboard.createCursorKeys()
        const speed = 100
        let vx = 0
        let vy = 0
        if (cursors.left.isDown) vx -= speed
        if (cursors.right.isDown) vx += speed
        if (cursors.up.isDown) vy -= speed
        if (cursors.down.isDown) vy += speed
        this.body.setVelocity(vx, vy)
    }
}

export class Drone extends EntityBase {
    sprite: Phaser.GameObjects.Sprite

    addToScene(scene: Phaser.Scene) {
        super.addToScene(scene)
        this.sprite = scene.physics.add.sprite(this.x, this.y, 'placeholder', 0)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
    }
}

export class Mob extends EntityBase {
    sprite: Phaser.GameObjects.Sprite

    addToScene(scene: Phaser.Scene) {
        super.addToScene(scene)
        this.sprite = scene.physics.add.sprite(this.x, this.y, 'placeholder', 0)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
    }
}

export class GameState {
    player: Player = new Player()
    drones: Drone[] = []
    mobs: Mob[] = []

    get entities() { return [this.player, ...this.drones, ...this.mobs] }
}

const gameState = new GameState()

export default class GameplayScene extends Phaser.Scene {

    constructor() { super('gameplay') }

    init() {

    }

    preload() {
        this.load.image('placeholder', '/assets/placeholder.png')
    }

    create() {
        for (const ent of gameState.entities) ent.addToScene(this)
    }

    update(t: number, dt: number) {
        for (const ent of gameState.entities) ent.update(t / 1000, dt / 1000)
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: '#111',
    width: 640,
    height: 360,
    scale: { mode: Phaser.Scale.ScaleModes.FIT, autoCenter: Phaser.Scale.Center.CENTER_BOTH },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: true,
        }
    },
    scene: GameplayScene,
};

const game = new Phaser.Game(config)
