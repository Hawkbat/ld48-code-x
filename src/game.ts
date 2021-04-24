import 'phaser'
import { Scene } from 'phaser'

const DEBUG = true

export abstract class EntityBase {
    active: boolean = false
    initialized: boolean = false
    spawned: boolean = false
    scene!: Phaser.Scene
    floorIndex: number = 0

    get floor() { return gameState.floors[this.floorIndex] }

    initialize() {
        this.initialized = true
    }

    spawn(scene: Phaser.Scene) {
        this.despawn()
        this.scene = scene
        this.active = true
        this.spawned = true
        if (!this.initialized) {
            this.initialize()
        }
    }

    despawn() {
        this.active = false
        this.spawned = false
        this.scene = undefined as any
    }

    destroy(): void {
        this.despawn()
    }

    update(t: number, dt: number) { }

    postUpdate() { }
}

export class Floor extends EntityBase {
    map!: Phaser.Tilemaps.Tilemap
    tilesets: Phaser.Tilemaps.Tileset[] = []
    collider!: Phaser.Physics.Arcade.Collider

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.map = this.scene.make.tilemap({ key: 'tilemap' })
        this.tilesets = [
            this.map.addTilesetImage('Test-BlockTile', 'tileset-blocks'),
            this.map.addTilesetImage('Test-Tiles', 'tileset-tiles'),
        ]
        const wallLayer = this.map.createLayer('Tile Layer 1', this.tilesets)
        wallLayer.setCollisionBetween(0, 999, true)
        this.collider = this.scene.physics.add.collider(gameState.player.sprite, wallLayer)
    }

    despawn() {
        super.despawn()
        if (this.map) this.map.destroy()
        if (this.collider) this.collider.destroy()
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
    }
}

export abstract class ActorBase extends EntityBase {
    sprite!: Phaser.GameObjects.Sprite

    constructor(public x: number, public y: number) {
        super()
    }

    abstract get spriteKey(): string

    get body() { return this.sprite.body as Phaser.Physics.Arcade.Body }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.sprite = scene.physics.add.sprite(this.x, this.y, this.spriteKey, 0)
    }

    despawn() {
        super.despawn()
        if (this.sprite) this.sprite.destroy()
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.x = this.sprite.x
        this.y = this.sprite.y
        this.sprite.setDepth(this.y)
    }
}

export abstract class UnitBase extends ActorBase {
    debugText!: Phaser.GameObjects.Text
    hurtTime: number = 0
    hurtDirX: number = 0
    hurtDirY: number = 0
    facing: 'up' | 'right' | 'down' | 'left' = 'down'

    get tileX() { return this.x / 32 + 0.5 }
    get tileY() { return this.y / 32 + 0.5 }

    get isHurting() { return this.hurtTime > 0 }

    constructor(x: number, y: number, public power: number, public maxPower: number = power) {
        super(x, y)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.body.setSize(24, 24)
        if (DEBUG) {
            this.debugText = this.scene.add.text(this.x, this.y, '', { color: '#F0F' })
            this.debugText.setDepth(9999)
        }
    }

    despawn() {
        super.despawn()
        if (this.debugText) this.debugText.destroy()
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        this.hurtTime -= dt
        this.sprite.tint = this.isHurting && Math.sin(t * Math.PI * 16) > 0 ? 0xFF0000 : 0xFFFFFF
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        if (DEBUG) {
            this.debugText.x = this.x
            this.debugText.y = this.y
            this.debugText.setText('' + this.power + '/' + this.maxPower + ' / ' + this.tileX + ', ' + this.tileY)
        }
        if (this.power <= 0) this.die()
    }

    hurt(damage: number, inflictor: ActorBase) {
        if (!this.isHurting) {
            const dmg = Math.min(this.power, damage)
            this.power -= dmg
            this.hurtTime = 1
            const dir = new Phaser.Math.Vector2(this.sprite.x - inflictor.sprite.x, this.sprite.y - inflictor.sprite.y).normalize()
            this.hurtDirX = dir.x
            this.hurtDirY = dir.y
        }
    }

    abstract die(): void
}

export class Player extends UnitBase {
    placing: boolean = false

    get spriteKey() { return 'player' }

    constructor() {
        super(50, 50, 50, 100)
    }

    initialize() {
        super.initialize()
        this.scene.anims.create({ key: 'player-up-left', frames: this.scene.anims.generateFrameNumbers('player', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-up-center', frames: this.scene.anims.generateFrameNumbers('player', { start: 4, end: 7 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-up-right', frames: this.scene.anims.generateFrameNumbers('player', { start: 8, end: 11 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-center-right', frames: this.scene.anims.generateFrameNumbers('player', { start: 12, end: 15 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-down-right', frames: this.scene.anims.generateFrameNumbers('player', { start: 16, end: 19 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-down-center', frames: this.scene.anims.generateFrameNumbers('player', { start: 20, end: 23 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-down-left', frames: this.scene.anims.generateFrameNumbers('player', { start: 24, end: 27 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'player-center-left', frames: this.scene.anims.generateFrameNumbers('player', { start: 28, end: 31 }), frameRate: 5, repeat: -1 })
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.playerGroup.add(this.sprite)
    }

    despawn() {
        super.despawn()
        gameState.playerGroup.remove(this.sprite)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        const cursors = this.scene.input.keyboard.createCursorKeys()
        const speed = 100
        let vx = 0
        let vy = 0
        if (cursors.left.isDown) vx -= speed
        if (cursors.right.isDown) vx += speed
        if (cursors.up.isDown) vy -= speed
        if (cursors.down.isDown) vy += speed
        if (vx !== 0 || vy !== 0) {
            const key = `player-${vy < 0 ? 'up' : vy > 0 ? 'down' : 'center'}-${vx < 0 ? 'left' : vx > 0 ? 'right' : 'center'}`
            this.sprite.anims.play(key, true)
        }
        if (vx !== 0) this.facing = vx > 0 ? 'right' : 'left'
        if (vy !== 0) this.facing = vy > 0 ? 'down' : 'up'
        if (this.hurtTime > 0.75) {
            vx += this.hurtDirX * speed * 2
            vy += this.hurtDirY * speed * 2
        }
        this.body.setVelocity(vx, vy)

        if (cursors.space.isDown && !this.placing) {
            this.placing = true
            this.power -= 10
            const drone = new Drone(this.x, this.y, 10)
            drone.facing = this.facing
            gameState.drones.push(drone)
        }
        if (!cursors.space.isDown && this.placing) this.placing = false
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.scene.cameras.main.setScroll(Math.round(this.body.x - this.scene.renderer.width / 2), Math.round(this.body.y - this.scene.renderer.height / 2))
    }

    die() {
        alert('Game over')
    }
}

export abstract class DroneBase extends UnitBase {

    initialize() {
        super.initialize()
        this.scene.anims.create({ key: `drone-up-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 0 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `drone-right-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 1, end: 1 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `drone-down-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 2, end: 2 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `drone-left-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 3, end: 3 }), frameRate: 5, repeat: -1 })
    }

    spawn(scene: Scene) {
        super.spawn(scene)
        this.sprite.setPosition(Math.round(this.tileX) * 32 - 16, Math.round(this.tileY) * 32 - 16)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        const tick = Math.floor(t / gameState.tickRate)
        if (t >= tick && t - dt <= tick) {
            this.tick()
        }
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.sprite.anims.play(`drone-${this.facing}-${this.spriteKey}`, true)
    }

    tick() {
        this.sprite.setPosition(Math.round(this.tileX) * 32 - 16, Math.round(this.tileY) * 32 - 16)
    }
}

export class Drone extends DroneBase {

    get spriteKey() { return 'drone-gun' }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.droneGroup.add(this.sprite)
    }

    despawn() {
        super.despawn()
        gameState.droneGroup.remove(this.sprite)
    }

    destroy() {
        super.destroy()
        gameState.drones.splice(gameState.drones.indexOf(this), 1)
    }

    tick() {
        super.tick()
        const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        gameState.bullets.push(new Pulse(this.x, this.y, dx, dy, 128, 1, true, 10))
        this.power--
    }

    die() {
        this.destroy()
    }
}

export class Mob extends DroneBase {
    collider!: Phaser.Physics.Arcade.Collider

    get spriteKey() { return 'drone-gun' }

    constructor(x: number, y: number, power: number, public impactDamage: number) {
        super(x, y, power)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.mobGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, [gameState.playerGroup, gameState.droneGroup], (_, other) => {
            const target = gameState.player.body === other.body ? gameState.player : gameState.drones.find(d => d.body === other.body)
            target?.hurt(this.impactDamage, this)
        }, undefined, this)
    }

    despawn() {
        super.despawn()
        gameState.mobGroup.remove(this.sprite)
        if (this.collider) this.collider.destroy()
    }

    destroy() {
        super.destroy()
        gameState.mobs.splice(gameState.mobs.indexOf(this), 1)
    }

    tick() {
        super.tick()
        const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        if (this.facing === 'up') this.facing = 'right'
        else if (this.facing === 'right') this.facing = 'down'
        else if (this.facing === 'down') this.facing = 'left'
        else if (this.facing === 'left') this.facing = 'up'
        gameState.bullets.push(new Pulse(this.x, this.y, dx, dy, 128, 1, false, 10))
    }

    die() {
        gameState.drops.push(new PowerDrop(this.x, this.y))
        this.destroy()
    }
}

export abstract class DropBase extends ActorBase {
    collider!: Phaser.Physics.Arcade.Collider

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.dropGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, gameState.playerGroup, () => {
            if (this.pickup()) this.destroy()
        }, undefined, this)
        this.collider.overlapOnly = true
    }

    despawn() {
        super.despawn()
        gameState.dropGroup.remove(this.sprite)
        if (this.collider) this.collider.destroy()
    }

    destroy() {
        super.destroy()
        gameState.drops.splice(gameState.drops.indexOf(this), 1)
    }

    abstract pickup(): boolean | undefined
}

export class PowerDrop extends DropBase {

    constructor(x: number, y: number, public power: number = 10) {
        super(x, y)
    }

    get spriteKey() { return 'placeholder' }

    pickup() {
        if (gameState.player.power < gameState.player.maxPower) {
            const delta = Math.min(gameState.player.maxPower - gameState.player.power, this.power)
            gameState.player.power += delta
            return true
        }
    }
}

export abstract class BulletBase extends ActorBase {
    collider!: Phaser.Physics.Arcade.Collider

    constructor(x: number, y: number, public dx: number, public dy: number, public speed: number, public lifetime: number) {
        super(x, y)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.bulletGroup.add(this.sprite)
        this.body.setSize(16, 16)
        this.collider = this.scene.physics.add.overlap(this.sprite, [gameState.playerGroup, gameState.droneGroup, gameState.mobGroup], (_, other) => {
            const target = gameState.player.body === other.body ? gameState.player : gameState.drones.find(d => d.body === other.body) ?? gameState.mobs.find(m => m.body === other.body)
            if (target && this.hit(target)) this.destroy()
        }, undefined, this)
        this.collider.overlapOnly = true
    }

    despawn() {
        super.despawn()
        gameState.bulletGroup.remove(this.sprite)
        if (this.collider) this.collider.destroy()
    }

    destroy() {
        super.destroy()
        gameState.bullets.splice(gameState.bullets.indexOf(this), 1)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        this.body.setVelocity(this.dx * this.speed, this.dy * this.speed)
        this.lifetime -= dt
        if (this.lifetime <= 0) this.destroy()
    }

    abstract hit(target: Player | Drone | Mob): boolean | undefined
}

export class Pulse extends BulletBase {

    get spriteKey() { return 'placeholder' }

    constructor(x: number, y: number, dx: number, dy: number, speed: number, lifetime: number, public friendly: boolean, public damage: number) {
        super(x, y, dx, dy, speed, lifetime)
    }

    hit(target: Player | Drone | Mob) {
        if (this.friendly === (target instanceof Player || target instanceof Drone)) return
        target.hurt(this.damage, this)
        return true
    }
}

export class GameState {
    player: Player = new Player()
    drones: Drone[] = [new Drone(100, 0, 25)]
    mobs: Mob[] = [new Mob(100, 100, 50, 10)]
    drops: DropBase[] = [new PowerDrop(200, 250)]
    bullets: BulletBase[] = [new Pulse(200, 100, -1, 0, 10, 2, true, 10)]
    floors: Floor[] = [new Floor()]
    floorIndex: number = 0

    tickRate: number = 1.0

    playerGroup!: Phaser.GameObjects.Group
    droneGroup!: Phaser.GameObjects.Group
    mobGroup!: Phaser.GameObjects.Group
    dropGroup!: Phaser.GameObjects.Group
    bulletGroup!: Phaser.GameObjects.Group

    get floor() { return this.floors[this.floorIndex] }

    get entities() { return [this.player, ...this.drones, ...this.mobs, ...this.drops, ...this.bullets, ...this.floors] }
}

const gameState = new GameState()

export class GameplayScene extends Phaser.Scene {

    constructor() { super('gameplay') }

    init() {

    }

    preload() {
        this.load.image('tileset-blocks', '/assets/Test-BlockTile.png')
        this.load.image('tileset-tiles', '/assets/Test-Tiles.png')
        this.load.tilemapTiledJSON('tilemap', 'assets/Code-X.json')
        this.load.image('placeholder', '/assets/placeholder.png')
        this.load.spritesheet('player', '/assets/Battery-Bot.png', { frameWidth: 32, frameHeight: 32 })
        this.load.spritesheet('drone-gun', '/assets/Drone_Gun.png', { frameWidth: 32, frameHeight: 32 })
    }

    create() {
        gameState.playerGroup = this.physics.add.group()
        gameState.droneGroup = this.physics.add.group()
        gameState.mobGroup = this.physics.add.group()
        gameState.dropGroup = this.physics.add.group()
        gameState.bulletGroup = this.physics.add.group()
    }

    update(t: number, dt: number) {
        for (const ent of gameState.entities.filter(e => e.floorIndex === gameState.floorIndex && !e.spawned)) ent.spawn(this)
        for (const ent of gameState.entities.filter(e => e.floorIndex !== gameState.floorIndex && e.spawned)) ent.despawn()
        for (const ent of gameState.entities.filter(e => e.spawned && e.active)) ent.update(t / 1000, dt / 1000)
        for (const ent of gameState.entities.filter(e => e.spawned && e.active)) ent.postUpdate()
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: '#111',
    width: 640,
    height: 360,
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
    scene: GameplayScene,
};

const game = new Phaser.Game(config)
