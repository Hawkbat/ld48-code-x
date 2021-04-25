import 'phaser'
import { Scene } from 'phaser'

const DEBUG = false

type Facing4Way = 'up' | 'right' | 'down' | 'left'
type Facing8Way = 'center-center' | 'up-left' | 'up-center' | 'up-right' | 'center-right' | 'down-right' | 'down-center' | 'down-left' | 'center-left'

window.onerror = (msg, src, line, col, err) => {
    if (!DEBUG) {
        alert(`Please screenshot this and report it!\n${msg}\nin ${src}:(${line},${col})`)
    }
    console.error(err)
}

function dist(a: { x: number, y: number }, b: { x: number, y: number }) {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
}

function get3dSound(ent: { x: number, y: number }) {
    return { pan: Math.min(1, Math.max(-1, (ent.x - gameState.player.x) / 640)), volume: 1 - Math.min(1, Math.max(dist(ent, gameState.player) / 320)) }
}

export class DroneSchematic {
    constructor(public name: string, public cost: number, public create: (creator: Player, schematic: DroneSchematic) => DroneBase) {

    }
}

export const droneSchematics = [
    new DroneSchematic('Turret', 10, (p, s) => new DroneGun(p.x, p.y, p.facing, s)),
    new DroneSchematic('Puncher', 15, (p, s) => new DroneHoverPunch(p.x, p.y, p.facing, s)),
    new DroneSchematic('Boomerang', 15, (p, s) => new DroneSpinBoomerang(p.x, p.y, p.facing, s)),
    new DroneSchematic('Tracker', 15, (p, s) => new DroneTracker(p.x, p.y, p.facing, s)),
]

export class EnemySchematic {

    constructor(public name: string, public create: (x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) => EnemyBase) {

    }
}

export const enemySchematics = [
    new EnemySchematic('Turret', (x, y, facing, s) => new EnemyGun(x, y, facing, s)),
    new EnemySchematic('Hover Turret', (x, y, facing, s) => new EnemyHoverGun(x, y, facing, s)),
    new EnemySchematic('Hover Puncher', (x, y, facing, s) => new EnemyHoverPunch(x, y, facing, s)),
    new EnemySchematic('Spin Boomerang', (x, y, facing, s) => new EnemySpinBoomerang(x, y, facing, s)),
    new EnemySchematic('Directional Turret', (x, y, facing, s) => new EnemyDirectionalTurret(x, y, facing, s)),
    new EnemySchematic('Multishot Turret', (x, y, facing, s) => new EnemyMultishot(x, y, facing, s)),
    new EnemySchematic('Hover Multishot', (x, y, facing, s) => new EnemyHoverMultishot(x, y, facing, s)),
]

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
    bgTileset!: Phaser.Tilemaps.Tileset
    fgTileset!: Phaser.Tilemaps.Tileset
    bgLayer!: Phaser.Tilemaps.TilemapLayer
    fgLayer!: Phaser.Tilemaps.TilemapLayer
    debugGrid!: Phaser.GameObjects.Grid
    debugGfx!: Phaser.GameObjects.Graphics
    debugLayer!: Phaser.Tilemaps.TilemapLayer
    collider!: Phaser.Physics.Arcade.Collider

    roomUpType: number = -1
    roomRightType: number = -1
    roomDownType: number = -1
    roomLeftType: number = -1

    get hasRoomUp() { return this.roomUpType >= 0 || this.isBossFloor }
    get hasRoomRight() { return this.roomRightType >= 0 }
    get hasRoomDown() { return this.roomDownType >= 0 }
    get hasRoomLeft() { return this.roomLeftType >= 0 }

    get floorNumber() { return this.floorIndex % 5 }
    get isTopFloor() { return this.floorNumber === 0 }
    get isBossFloor() { return this.floorNumber === 4 }

    initialize() {
        super.initialize()
        this.floorIndex = gameState.floors.indexOf(this)

        this.roomUpType = Math.random() > 0.25 ? Math.floor(Math.random() * 2) : -1
        this.roomRightType = Math.random() > 0.25 ? Math.floor(Math.random() * 2) : -1
        this.roomDownType = Math.random() > 0.25 ? Math.floor(Math.random() * 2) : -1
        this.roomLeftType = Math.random() > 0.25 ? Math.floor(Math.random() * 2) : -1
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.map = this.scene.make.tilemap({ key: 'tilemap' })

        this.bgTileset = this.map.addTilesetImage('Test-Tiles', 'tileset-tiles')
        this.fgTileset = this.map.addTilesetImage('Test-BlockTile', 'tileset-blocks')

        this.bgLayer = this.map.createLayer('Floors', this.bgTileset, -384, -1024 + -128 + 8)
        this.fgLayer = this.map.createLayer('Walls', this.fgTileset, -384, -1024 + -128 + 0)

        this.bgLayer.setDepth(-9001)
        this.fgLayer.setDepth(-9000)
        this.fgLayer.setCollisionByExclusion([-1, 0, 1, 1024, 1025])

        // Elevator floor indicators
        this.setTile(9, 32, 32 * this.floorNumber + 6)
        this.setTile(10, 32, 32 * this.floorNumber + 7)
        this.setTile(13, 32, 32 * this.floorNumber + 4)
        this.setTile(14, 32, 32 * this.floorNumber + 5)

        // Elevator buttons
        this.setTile(9, 33, null, this.isBossFloor ? 194 : 192)
        this.setTile(10, 33, null, this.isBossFloor ? 195 : 193)
        this.setTile(13, 33, null, this.isTopFloor ? 194 : 192)
        this.setTile(14, 33, null, this.isTopFloor ? 195 : 193)

        // Boss rooms
        if (this.isBossFloor) {

        } else {
            this.clearRect(0, 0, 24, 24)
        }

        if (this.hasRoomUp) {

        } else {
            this.clearRect(8, 24, 8, 8)
        }

        if (this.hasRoomRight) {

        } else {
            this.clearRect(16, 32, 8, 8)
        }

        if (this.hasRoomDown) {

        } else {
            this.clearRect(8, 40, 8, 8)
        }

        if (this.hasRoomLeft) {

        } else {
            this.clearRect(0, 32, 8, 8)
        }

        // Elevator doors
        this.setTile(11, 32, this.hasRoomUp ? -1 : 164, this.hasRoomUp ? 160 : -1)
        this.setTile(12, 32, this.hasRoomUp ? -1 : 165, this.hasRoomUp ? 161 : -1)
        this.setTile(11, 39, this.hasRoomDown ? -1 : 164, this.hasRoomDown ? 160 : -1)
        this.setTile(12, 39, this.hasRoomDown ? -1 : 165, this.hasRoomDown ? 161 : -1)
        this.setTile(8, 35, this.hasRoomLeft ? -1 : 166, this.hasRoomLeft ? 162 : -1)
        this.setTile(8, 36, this.hasRoomLeft ? -1 : 167, this.hasRoomLeft ? 163 : -1)
        this.setTile(15, 35, this.hasRoomRight ? -1 : 166, this.hasRoomRight ? 162 : -1)
        this.setTile(15, 36, this.hasRoomRight ? -1 : 167, this.hasRoomRight ? 163 : -1)

        if (DEBUG) {
            this.debugGrid = this.scene.add.grid(0, 0, 1024, 1024, 32, 32, undefined, undefined, 0xFF00FF, 0.25)
            this.debugGfx = this.scene.add.graphics({ x: 0, y: 0 })
            this.debugLayer = this.fgLayer.renderDebug(this.debugGfx)
        }

        this.collider = this.scene.physics.add.collider([gameState.playerGroup, gameState.droneGroup, gameState.enemyGroup, gameState.bulletGroup], this.fgLayer, other => {
            gameState.bumpSound.play(get3dSound(other.body))

            const b = gameState.bullets.find(b => b.spawned && b.body === other.body)
            if (b) b.destroy()
            const d = gameState.drones.find(d => d.spawned && d.body === other.body)
            if (d) d.wallCollision()
            const e = gameState.enemies.find(e => e.spawned && e.body === other.body)
            if (e) e.wallCollision()
        })
    }

    despawn() {
        super.despawn()
        if (this.map) this.map.destroy()
        if (this.bgLayer) this.bgLayer.destroy()
        if (this.fgLayer) this.fgLayer.destroy()
        if (this.debugGrid) this.debugGrid.destroy()
        if (this.debugGfx) this.debugGfx.destroy()
        if (this.debugLayer) this.debugLayer.destroy()
        if (this.collider) this.collider.destroy()
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
    }

    private setTile(x: number, y: number, fgIndex?: number | null, bgIndex?: number | null) {
        if (fgIndex) {
            this.fgLayer.putTileAt(1024 + 1 + fgIndex, x, y)
            this.fgLayer.getTileAt(x, y)?.setSize(32, 40, 32, 32)
        }
        if (bgIndex) this.bgLayer.putTileAt(1 + bgIndex, x, y)
    }

    private copyRect(sx: number, sy: number, dx: number, dy: number, w: number, h: number) {
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                this.fgLayer.putTileAt(this.fgLayer.getTileAt(sx + x, sy + y, true), dx + x, dy + y)
                this.fgLayer.getTileAt(dx + x, dy + y)?.setSize(32, 40, 32, 32)
                this.bgLayer.putTileAt(this.bgLayer.getTileAt(sx + x, sy + y, true), dx + x, dy + y)
            }
        }
    }

    private clearRect(dx: number, dy: number, w: number, h: number) {
        for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
                this.fgLayer.putTileAt(-1, dx + x, dy + y)
                this.bgLayer.putTileAt(-1, dx + x, dy + y)
            }
        }
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
    shadowSprite!: Phaser.GameObjects.Sprite
    hurtTime: number = 0
    hurtDirX: number = 0
    hurtDirY: number = 0
    facing: 'up' | 'right' | 'down' | 'left' = 'down'
    dead: boolean = false

    get tileX() { return this.x / 32 + 0.5 }
    get tileY() { return this.y / 32 + 0.5 }
    get mapX() { return this.floor.fgLayer.getTileAtWorldXY(this.x, this.y, true).x }
    get mapY() { return this.floor.fgLayer.getTileAtWorldXY(this.x, this.y, true).y }

    get isHurting() { return this.hurtTime > 0 }

    abstract get invulnPeriod(): number
    abstract get movementType(): 'stationary' | 'hovering' | 'spinning' | 'directional'

    constructor(x: number, y: number, public power: number, public maxPower: number = power) {
        super(x, y)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.shadowSprite = this.scene.add.sprite(this.x, this.y, 'drop-shadow')
        this.body.setSize(24, 24)
    }

    despawn() {
        super.despawn()
        if (this.shadowSprite) this.shadowSprite.destroy()
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
        this.shadowSprite.setPosition(this.sprite.x, this.sprite.y + (this.movementType === 'stationary' ? -2 : 6))
        this.shadowSprite.setDepth(this.sprite.depth - 1)
        if (this.power <= 0 && !this.dead) this.die()
    }

    hurt(damage: number, inflictor: ActorBase) {
        if (!this.isHurting && !this.dead) {
            const dmg = Math.min(this.power, damage)
            if (dmg > 0) {
                this.power -= dmg
                this.hurtTime = this.invulnPeriod
                const dir = new Phaser.Math.Vector2(this.sprite.x - inflictor.sprite.x, this.sprite.y - inflictor.sprite.y).normalize()
                this.hurtDirX = dir.x
                this.hurtDirY = dir.y
                gameState.damageSound.play(get3dSound(this))
            }
        }
    }

    die(): void {
        this.dead = true
    }
}

export class Player extends UnitBase {
    placing: boolean = false
    swapping: boolean = false
    schematics: (DroneSchematic | null)[] = [droneSchematics[0], null, null]
    schematicIndex: number = 0

    get spriteKey() { return 'player' }
    get movementType() { return 'hovering' as const }
    get invulnPeriod() { return 1 }

    constructor() {
        super(0, 0, 50, 100)
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
        if (!this.active || this.dead) return
        const cursors = this.scene.input.keyboard.createCursorKeys()
        const speed = 128
        let vx = 0
        let vy = 0
        if (cursors.left.isDown) vx -= 1
        if (cursors.right.isDown) vx += 1
        if (cursors.up.isDown) vy -= 1
        if (cursors.down.isDown) vy += 1
        if (vx !== 0 && vy !== 0) {
            vx *= Math.sqrt(0.5)
            vy *= Math.sqrt(0.5)
        }
        if (vx !== 0 || vy !== 0) {
            const key = `player-${vy < 0 ? 'up' : vy > 0 ? 'down' : 'center'}-${vx < 0 ? 'left' : vx > 0 ? 'right' : 'center'}`
            this.sprite.anims.play(key, true)
        }
        if (vx !== 0) this.facing = vx > 0 ? 'right' : 'left'
        if (vy !== 0) this.facing = vy > 0 ? 'down' : 'up'
        if (this.hurtTime > 0.75) {
            vx += this.hurtDirX * 2
            vy += this.hurtDirY * 2
        }
        this.body.setVelocity(vx * speed, vy * speed)

        if (cursors.space.isDown && !this.placing) {
            this.placing = true

            const d = gameState.drones.filter(d => dist(this.sprite, d) < 20).sort((a, b) => dist(this.sprite, a) - dist(this.sprite, b))[0]

            const i = gameState.interactibles.filter(i => dist(this.sprite, i) < 20).sort((a, b) => dist(this.sprite, a) - dist(this.sprite, b))[0]

            if (d) {
                const refund = Math.min(this.maxPower - this.power, d.power)
                this.power += refund
                d.destroy()
            } else if (i) {
                i.interact()
            } else {
                const s = this.schematics[this.schematicIndex]
                if (s && this.power > s.cost && !gameState.drones.some(d => d.schematic === s)) {
                    this.power -= s.cost
                    const drone = s.create(this, s)
                    gameState.drones.push(drone)
                }
            }
        }
        if (!cursors.space.isDown && this.placing) this.placing = false

        if (cursors.shift.isDown && !this.swapping) {
            this.swapping = true
            this.schematicIndex = (this.schematicIndex + 1) % this.schematics.length
        }
        if (!cursors.shift.isDown && this.swapping) this.swapping = false
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.scene.cameras.main.setScroll(Math.round(this.body.x - this.scene.renderer.width / 2), Math.round(this.body.y - this.scene.renderer.height / 2))
    }

    die() {
        super.die()
        this.body.setVelocity(0, 0)
    }
}

export abstract class DroneLikeBase extends UnitBase {
    attachSprite!: Phaser.GameObjects.Sprite
    barSprite!: Phaser.GameObjects.Sprite

    abstract get attachSpriteKey(): string

    constructor(x: number, y: number, facing: Facing4Way, power: number, public impactDamage: number) {
        super(x, y, power)
        this.facing = facing
    }

    initialize() {
        super.initialize()
        if (this.movementType === 'hovering' || this.movementType === 'directional') {
            this.scene.anims.create({ key: `drone-up-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 4, end: 7 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 8, end: 11 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 12, end: 15 }), frameRate: 5, repeat: -1 })

            this.scene.anims.create({ key: `drone-up-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 4, end: 7 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 8, end: 11 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 12, end: 15 }), frameRate: 5, repeat: -1 })
        } else if (this.movementType === 'spinning') {
            this.scene.anims.create({ key: `drone-up-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })

            this.scene.anims.create({ key: `drone-up-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
        } else {
            this.scene.anims.create({ key: `drone-up-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 0 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 1, end: 1 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 2, end: 2 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 3, end: 3 }), frameRate: 5, repeat: -1 })
        }
    }

    spawn(scene: Scene) {
        super.spawn(scene)
        this.sprite.setPosition(Math.round(this.tileX) * 32 - 16, Math.round(this.tileY) * 32 - 16)
        this.attachSprite = this.scene.add.sprite(this.sprite.x, this.sprite.y, this.attachSpriteKey)
        this.barSprite = this.scene.add.sprite(this.sprite.x, this.sprite.y, 'power-bar')
        this.barSprite.setDepth(9000)
    }

    despawn() {
        super.despawn()
        if (this.attachSprite) this.attachSprite.destroy()
        if (this.barSprite) this.barSprite.destroy()
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active || this.dead) return
        const tick = Math.floor(t / gameState.tickRate) * gameState.tickRate
        if (t / gameState.tickRate >= tick && t - dt <= tick) {
            this.tick()
        }
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        if (this.movementType !== 'stationary') this.sprite.anims.play(`drone-${this.facing}-${this.spriteKey}`, true)
        this.attachSprite.setPosition(this.sprite.x, this.sprite.y)
        this.attachSprite.anims.play(`drone-${this.facing}-${this.attachSpriteKey}`, true)
        this.attachSprite.setDepth(this.sprite.depth + 0.1)
        this.barSprite.setPosition(this.sprite.x, this.sprite.y - 16)
        this.barSprite.setFrame(29 - Math.floor(this.power / this.maxPower * 29))
    }

    tick() {
        this.sprite.setPosition(Math.round(this.tileX) * 32 - 16, Math.round(this.tileY) * 32 - 16)
    }

    wallCollision() {

    }

    die() {
        super.die()
        this.body.setVelocity(0, 0)
    }
}

export abstract class DroneBase extends DroneLikeBase {
    collider!: Phaser.Physics.Arcade.Collider

    get spriteKey() {
        return this.movementType === 'hovering' ? 'drone-core-hover' :
            this.movementType === 'spinning' ? 'drone-core-spin' :
                this.movementType === 'directional' ? 'drone-core-directional' :
                    'drone-core'
    }
    get invulnPeriod() { return 1 }

    constructor(x: number, y: number, facing: Facing4Way, impactDamage: number, public schematic: DroneSchematic) {
        super(x, y, facing, schematic.cost, impactDamage)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.droneGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, gameState.enemyGroup, (_, other) => {
            if (!this.dead && this.power > 0) {
                const target = gameState.enemies.find(e => e.spawned && e.body === other.body)
                target?.hurt(this.impactDamage, this)
            }
        }, undefined, this)
    }

    despawn() {
        super.despawn()
        gameState.droneGroup.remove(this.sprite)
        if (this.collider) this.collider.destroy()
    }

    destroy() {
        super.destroy()
        gameState.drones.splice(gameState.drones.indexOf(this), 1)
    }

    tick() {
        super.tick()
    }
}

export class DroneGun extends DroneBase {
    get attachSpriteKey() { return 'drone-gun' }
    get movementType() { return 'stationary' as const }

    constructor(x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(x, y, facing, 0, schematic)
    }

    tick() {
        super.tick()
        const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx, dy, 512, 2, true, 5))
        this.power--
    }
}

export class DroneTracker extends DroneBase {
    subtick: number = 0

    get attachSpriteKey() { return 'drone-tracking' }
    get movementType() { return 'stationary' as const }

    constructor(x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(x, y, facing, 0, schematic)
    }

    tick() {
        super.tick()
        let dx = gameState.player.sprite.x - this.sprite.x
        let dy = gameState.player.sprite.y - this.sprite.y
        if (Math.abs(dx) > Math.abs(dy))
            this.facing = dx < 0 ? 'left' : 'right'
        else
            this.facing = dy < 0 ? 'up' : 'down'

        dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        if (this.subtick === 1) {
            gameState.bullets.push(new BulletTracker(this.x + dx * 16, this.y + dy * 16, dx, dy, true, 15))
        }
        this.subtick = (this.subtick + 1) % 2
        this.power--
    }
}

export class DroneHoverPunch extends DroneBase {
    collisionDebounce: number = 0

    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'drone-punch-hover' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(x, y, facing, 10, schematic)
    }

    tick() {
        super.tick()
        this.recalculateVelocity()
        this.power--
        this.collisionDebounce--
    }

    wallCollision() {
        super.wallCollision()
        if (this.collisionDebounce <= 0) {
            this.collisionDebounce = 2
            if (this.facing === 'up') this.facing = 'down'
            else if (this.facing === 'right') this.facing = 'left'
            else if (this.facing === 'down') this.facing = 'up'
            else if (this.facing === 'left') this.facing = 'right'
            this.recalculateVelocity()
            super.tick()
        }
    }

    private recalculateVelocity() {
        const speed = 128
        const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        this.body.setVelocity(dx * speed, dy * speed)
    }
}

export class DroneSpinBoomerang extends DroneBase {
    collisionDebounce: number = 0

    get movementType() { return 'spinning' as const }
    get attachSpriteKey() { return 'drone-boomerang-spin' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(x, y, facing, 10, schematic)
    }

    tick() {
        super.tick()
        const speed = 64
        const dx = this.facing === 'up' || this.facing === 'right' ? 1 : -1
        const dy = this.facing === 'down' || this.facing === 'right' ? 1 : -1
        this.body.setVelocity(dx * speed, dy * speed)
        this.collisionDebounce--
    }

    wallCollision() {
        super.wallCollision()
        if (this.collisionDebounce <= 0) {
            this.collisionDebounce = 2
            switch (this.facing) {
                case 'up':
                    if (this.body.blocked.up) this.facing = 'right'
                    if (this.body.blocked.right) this.facing = 'left'
                    break
                case 'right':
                    if (this.body.blocked.right) this.facing = 'down'
                    if (this.body.blocked.down) this.facing = 'up'
                    break
                case 'down':
                    if (this.body.blocked.down) this.facing = 'left'
                    if (this.body.blocked.left) this.facing = 'right'
                    break
                case 'left':
                    if (this.body.blocked.left) this.facing = 'up'
                    if (this.body.blocked.up) this.facing = 'down'
                    break
            }
            this.tick()
        }
    }
}

export abstract class EnemyBase extends DroneLikeBase {
    collider!: Phaser.Physics.Arcade.Collider

    get spriteKey() {
        return this.movementType === 'hovering' ? 'enemy-core-hover' :
            this.movementType === 'spinning' ? 'enemy-core-spin' :
                this.movementType === 'directional' ? 'enemy-core-directional' :
                    'enemy-core'
    }
    get invulnPeriod() { return 0.25 }

    constructor(x: number, y: number, facing: Facing4Way, power: number, impactDamage: number, public schematic: EnemySchematic) {
        super(x, y, facing, power, impactDamage)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.enemyGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, [gameState.playerGroup, gameState.droneGroup], (_, other) => {
            const target = gameState.player.body === other.body ? gameState.player : gameState.drones.find(d => d.spawned && d.body === other.body)
            target?.hurt(this.impactDamage, this)
        }, undefined, this)
    }

    despawn() {
        super.despawn()
        gameState.enemyGroup.remove(this.sprite)
        if (this.collider) this.collider.destroy()
    }

    destroy() {
        super.destroy()
        gameState.enemies.splice(gameState.enemies.indexOf(this), 1)
    }

    die() {
        super.die()
        if (Math.random() < 0.1) {
            const choices = droneSchematics.filter(s => !gameState.player.schematics.includes(s))
            if (choices.length) gameState.drops.push(new DropSchematic(this.x, this.y, choices[Math.floor(Math.random() * choices.length)]))
        } else {
            gameState.drops.push(new DropPower(this.x, this.y, 10))
        }
        this.destroy()
    }
}

export class EnemyGun extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'stationary' as const }
    get attachSpriteKey() { return 'enemy-gun' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 15, 5, schematic)
    }

    tick() {
        super.tick()
        if (this.subtick === 0) {
            if (this.facing === 'up') this.facing = 'right'
            else if (this.facing === 'right') this.facing = 'down'
            else if (this.facing === 'down') this.facing = 'left'
            else if (this.facing === 'left') this.facing = 'up'
        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx, dy, 512, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyMultishot extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'stationary' as const }
    get attachSpriteKey() { return 'enemy-multishot' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 20, 5, schematic)
    }

    tick() {
        super.tick()
        if (this.subtick === 0) {
            if (this.facing === 'up') this.facing = 'right'
            else if (this.facing === 'right') this.facing = 'down'
            else if (this.facing === 'down') this.facing = 'left'
            else if (this.facing === 'left') this.facing = 'up'
        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0

            const ox = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            const oy = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0

            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx + ox, dy + oy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx, dy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx - ox, dy - oy, 256, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyHoverGun extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'enemy-gun-hover' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 20, 5, schematic)
    }

    tick() {
        super.tick()
        if (this.subtick === 0) {
            let dx = gameState.player.sprite.x - this.sprite.x
            let dy = gameState.player.sprite.y - this.sprite.y
            if (Math.abs(dx) > Math.abs(dy))
                this.facing = dx < 0 ? 'left' : 'right'
            else
                this.facing = dy < 0 ? 'up' : 'down'
        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx, dy, 512, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyHoverMultishot extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'enemy-multishot-hover' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 25, 5, schematic)
    }

    tick() {
        super.tick()
        if (this.subtick === 0) {
            let dx = gameState.player.sprite.x - this.sprite.x
            let dy = gameState.player.sprite.y - this.sprite.y
            if (Math.abs(dx) > Math.abs(dy))
                this.facing = dx < 0 ? 'left' : 'right'
            else
                this.facing = dy < 0 ? 'up' : 'down'
        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0

            const ox = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            const oy = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0

            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx + ox, dy + oy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx, dy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx - ox, dy - oy, 256, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyHoverPunch extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'enemy-punch-hover' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 20, 10, schematic)
    }

    tick() {
        super.tick()
        const speed = 64
        let dx = gameState.player.sprite.x - this.sprite.x
        let dy = gameState.player.sprite.y - this.sprite.y
        if (this.subtick === 0)
            this.facing = dx < 0 ? 'left' : 'right'
        else if (this.subtick === 1)
            this.facing = dy < 0 ? 'up' : 'down'

        dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        this.body.setVelocity(dx * speed, dy * speed)
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemySpinBoomerang extends EnemyBase {
    collisionDebounce: number = 0

    get movementType() { return 'spinning' as const }
    get attachSpriteKey() { return 'enemy-boomerang-spin' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 20, 10, schematic)
    }

    tick() {
        super.tick()
        const speed = 64
        const dx = this.facing === 'up' || this.facing === 'right' ? 1 : -1
        const dy = this.facing === 'down' || this.facing === 'right' ? 1 : -1
        this.body.setVelocity(dx * speed, dy * speed)
        this.collisionDebounce--
    }

    wallCollision() {
        super.wallCollision()
        if (this.collisionDebounce <= 0) {
            this.collisionDebounce = 2
            switch (this.facing) {
                case 'up':
                    if (this.body.blocked.up) this.facing = 'right'
                    if (this.body.blocked.right) this.facing = 'left'
                    break
                case 'right':
                    if (this.body.blocked.right) this.facing = 'down'
                    if (this.body.blocked.down) this.facing = 'up'
                    break
                case 'down':
                    if (this.body.blocked.down) this.facing = 'left'
                    if (this.body.blocked.left) this.facing = 'right'
                    break
                case 'left':
                    if (this.body.blocked.left) this.facing = 'up'
                    if (this.body.blocked.up) this.facing = 'down'
                    break
            }
            this.tick()
        }
    }
}

export class EnemyDirectionalTurret extends EnemyBase {
    moveFacing: Facing4Way = 'up'
    collisionDebounce: number = 0

    get movementType() { return 'directional' as const }
    get attachSpriteKey() { return 'enemy-gun-hover' }

    constructor(x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(x, y, facing, 10, 5, schematic)
        this.moveFacing =
            facing === 'up' ? 'right' :
                facing === 'right' ? 'down' :
                    facing === 'down' ? 'left' :
                        'up'
    }

    tick() {
        super.tick()
        this.recalculateVelocity()
        this.collisionDebounce--

        const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        gameState.bullets.push(new BulletPulse(this.x + dx * 16, this.y + dy * 16, dx, dy, 512, 2, false, 5))
    }

    wallCollision() {
        super.wallCollision()
        if (this.collisionDebounce <= 0) {
            this.collisionDebounce = 2
            if (this.moveFacing === 'up') this.moveFacing = 'down'
            else if (this.moveFacing === 'right') this.moveFacing = 'left'
            else if (this.moveFacing === 'down') this.moveFacing = 'up'
            else if (this.moveFacing === 'left') this.moveFacing = 'right'
            this.recalculateVelocity()
            super.tick()
        }
    }

    private recalculateVelocity() {
        const speed = 64
        const dx = this.moveFacing === 'left' ? -1 : this.moveFacing === 'right' ? 1 : 0
        const dy = this.moveFacing === 'up' ? -1 : this.moveFacing === 'down' ? 1 : 0
        this.body.setVelocity(dx * speed, dy * speed)
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

export class DropPower extends DropBase {

    constructor(x: number, y: number, public power: number) {
        super(x, y)
    }

    get spriteKey() { return 'pickup-energy' }

    initialize() {
        super.initialize()
        this.scene.anims.create({ key: this.spriteKey, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, {}) })
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.sprite.anims.play(this.spriteKey, true)
    }

    pickup() {
        if (gameState.player.power < gameState.player.maxPower) {
            const delta = Math.min(gameState.player.maxPower - gameState.player.power, this.power)
            gameState.player.power += delta
            gameState.powerUpSound.play(get3dSound(this))
            return true
        }
    }
}

export class DropSchematic extends DropBase {

    constructor(x: number, y: number, public schematic: DroneSchematic) {
        super(x, y)
    }

    get spriteKey() { return 'placeholder' }

    pickup() {
        if (gameState.player.schematics.some(s => s === this.schematic)) return
        const slotIndex = gameState.player.schematics.findIndex(s => s === null)
        if (slotIndex === -1) return
        gameState.player.schematics[slotIndex] = this.schematic
        return true
    }
}

export abstract class BulletBase extends ActorBase {
    collider!: Phaser.Physics.Arcade.Collider

    constructor(x: number, y: number, public dx: number, public dy: number, public speed: number, public lifetime: number, public friendly: boolean) {
        super(x, y)
    }

    initialize() {
        super.initialize()

        gameState.shootSound.play(get3dSound(this))

        this.scene.anims.create({ key: `bullet-up-left-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 0 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-up-center-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 1, end: 1 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-up-right-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 2, end: 2 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-center-right-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 3, end: 3 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-down-right-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 4, end: 4 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-down-center-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 5, end: 5 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-down-left-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 6, end: 6 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: `bullet-center-left-${this.spriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 7, end: 7 }), frameRate: 5, repeat: -1 })
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        gameState.bulletGroup.add(this.sprite)
        this.body.setSize(8, 8)
        this.collider = this.scene.physics.add.overlap(this.sprite, [gameState.playerGroup, gameState.droneGroup, gameState.enemyGroup], (_, other) => {
            const target = gameState.player.body === other.body ? gameState.player : (gameState.drones.find(d => d.spawned && d.body === other.body) ?? gameState.enemies.find(e => e.spawned && e.body === other.body))
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

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        const f: Facing8Way = `${this.dy < -0.25 ? 'up' : this.dy > 0.25 ? 'down' : 'center'}-${this.dx < -0.25 ? 'left' : this.dx > 0.25 ? 'right' : 'center'}` as const
        const key = `bullet-${f}-${this.spriteKey}`
        this.sprite.anims.play(key, true)
    }

    abstract hit(target: Player | DroneBase | EnemyBase): boolean | undefined
}

export class BulletPulse extends BulletBase {

    get spriteKey() { return this.friendly ? 'projectile-ally' : 'projectile-enemy' }

    constructor(x: number, y: number, dx: number, dy: number, speed: number, lifetime: number, friendly: boolean, public damage: number) {
        super(x, y, dx, dy, speed, lifetime, friendly)
    }

    hit(target: Player | DroneBase | EnemyBase) {
        if (this.friendly === (target instanceof Player || target instanceof DroneBase)) return
        target.hurt(this.damage, this)
        return true
    }
}

export class BulletTracker extends BulletBase {
    trackingTime: number = 0.5

    get spriteKey() { return this.friendly ? 'projectile-ally-tracking' : 'projectile-enemy-tracking' }

    constructor(x: number, y: number, dx: number, dy: number, friendly: boolean, public damage: number) {
        super(x, y, dx, dy, 192, 5, friendly)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        this.trackingTime -= dt
        if (this.trackingTime > 0) {
            const dir = new Phaser.Math.Vector2(gameState.player.sprite.x - this.sprite.x, gameState.player.sprite.y - this.sprite.y).normalize()
            this.dx = dir.x
            this.dy = dir.y
        }
    }

    hit(target: Player | DroneBase | EnemyBase) {
        if (this.friendly === (target instanceof Player || target instanceof DroneBase)) return
        target.hurt(this.damage, this)
        return true
    }
}

export abstract class InteractableBase extends ActorBase {

    destroy() {
        super.destroy()
        gameState.interactibles.splice(gameState.interactibles.indexOf(this), 1)
    }

    abstract interact(): void
}

export class InteractablePowerCore extends InteractableBase {
    power: number = 25

    get spriteKey() { return 'destructible-power-core' }

    interact() {
        if (gameState.player.power < gameState.player.maxPower) {
            const delta = Math.min(gameState.player.maxPower - gameState.player.power, this.power)
            gameState.player.power += delta
            gameState.powerUpSound.play(get3dSound(this))
            this.destroy()
        }
    }
}

export class GameState {
    player: Player = new Player()
    drones: DroneBase[] = []
    enemies: EnemyBase[] = [
        new EnemyGun(256, 64, 'down', enemySchematics[0]),
        new EnemyHoverGun(240, -32, 'right', enemySchematics[1]),
        new EnemyHoverPunch(272, 32, 'left', enemySchematics[2]),
        new EnemySpinBoomerang(64, 48, 'right', enemySchematics[3]),
        new EnemyDirectionalTurret(64, 16, 'left', enemySchematics[4]),
        new EnemyMultishot(240, 64, 'up', enemySchematics[5]),
        new EnemyHoverMultishot(256, -64, 'left', enemySchematics[6]),
    ]
    drops: DropBase[] = []
    bullets: BulletBase[] = []
    interactibles: InteractableBase[] = [new InteractablePowerCore(176, -80)]
    floors: Floor[] = [new Floor()]
    floorIndex: number = 0

    tickRate: number = 0.5

    playerGroup!: Phaser.GameObjects.Group
    droneGroup!: Phaser.GameObjects.Group
    enemyGroup!: Phaser.GameObjects.Group
    dropGroup!: Phaser.GameObjects.Group
    bulletGroup!: Phaser.GameObjects.Group

    music!: Phaser.Sound.BaseSound
    bumpSound!: Phaser.Sound.BaseSound
    damageSound!: Phaser.Sound.BaseSound
    shootSound!: Phaser.Sound.BaseSound
    powerUpSound!: Phaser.Sound.BaseSound

    get floor() { return this.floors[this.floorIndex] }

    get entities() { return [this.player, ...this.drones, ...this.enemies, ...this.drops, ...this.bullets, ...this.interactibles, ...this.floors] }
}

const gameState = new GameState()

export class GameplayScene extends Phaser.Scene {
    text!: Phaser.GameObjects.Text

    constructor() { super('gameplay') }

    init() {

    }

    preload() {
        this.load.image('tileset-blocks', 'assets/Test-BlockTile.png')
        this.load.image('tileset-tiles', 'assets/Test-Tiles.png')
        this.load.tilemapTiledJSON('tilemap', 'assets/Code-X.json')
        this.load.image('placeholder', 'assets/placeholder.png')
        this.load.spritesheet('player', 'assets/Battery-Bot.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core', 'assets/Drone-Core.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core-hover', 'assets/Drone-Core-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core-spin', 'assets/Drone-Core-Spinning.png', { frameWidth: 32 })
        this.load.spritesheet('drone-core-directional', 'assets/Drone-Core-Directional.png', { frameWidth: 32 })
        this.load.spritesheet('drone-gun', 'assets/Drone_Gun.png', { frameWidth: 32 })
        this.load.spritesheet('drone-tracking', 'assets/Drone-Tracking-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('drone-punch-hover', 'assets/Drone-Punch-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('drone-boomerang-spin', 'assets/Drone-Boomerang.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core', 'assets/Enemy-Core-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-gun', 'assets/Enemy-Gun-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-multishot', 'assets/Enemy-Multishot-Stationary.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core-hover', 'assets/Enemy-Core-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core-spin', 'assets/Enemy-Core-Spinning.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-core-directional', 'assets/Enemy-Core-Directional.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-gun-hover', 'assets/Enemy-Gun-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-punch-hover', 'assets/Enemy-Punch-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-multishot-hover', 'assets/Enemy-Multishot-Hovering.png', { frameWidth: 32 })
        this.load.spritesheet('enemy-boomerang-spin', 'assets/Enemy-Boomerang.png', { frameWidth: 32 })
        this.load.spritesheet('power-bar', 'assets/Power-Bar.png', { frameWidth: 32 })
        this.load.spritesheet('drop-shadow', 'assets/DropShadow.png', { frameWidth: 32 })
        this.load.spritesheet('pickup-energy', 'assets/Pickup-Energy.png', { frameWidth: 8 })
        this.load.image('destructible-power-core', 'assets/Destructable-Powercore.png')
        this.load.spritesheet('projectile-ally', 'assets/Projectile-Ally.png', { frameWidth: 32 })
        this.load.spritesheet('projectile-enemy', 'assets/Projectile-Enemy.png', { frameWidth: 32 })
        this.load.spritesheet('projectile-ally-tracking', 'assets/Projectile-Ally-Tracking.png', { frameWidth: 32 })
        this.load.audio('music', 'assets/dire-space-emergency.mp3')
        this.load.audio('sound-bump', 'assets/bump.wav')
        this.load.audio('sound-damage', 'assets/damage.wav')
        this.load.audio('sound-shoot', 'assets/laserShoot.wav')
        this.load.audio('sound-power-up', 'assets/powerUp.wav')
    }

    create() {
        gameState.playerGroup = this.physics.add.group()
        gameState.droneGroup = this.physics.add.group()
        gameState.enemyGroup = this.physics.add.group()
        gameState.dropGroup = this.physics.add.group()
        gameState.bulletGroup = this.physics.add.group()
        this.text = this.add.text(0, 0, '', { color: 'white', backgroundColor: 'dimgray' })
        this.text.setDepth(9999)
        this.text.setScrollFactor(0, 0)
        gameState.music = this.sound.add('music')
        gameState.bumpSound = this.sound.add('sound-bump')
        gameState.damageSound = this.sound.add('sound-damage')
        gameState.shootSound = this.sound.add('sound-shoot')
        gameState.powerUpSound = this.sound.add('sound-power-up')
    }

    update(t: number, dt: number) {
        for (const ent of gameState.entities.filter(e => e.floorIndex === gameState.floorIndex && !e.spawned)) ent.spawn(this)
        for (const ent of gameState.entities.filter(e => e.floorIndex !== gameState.floorIndex && e.spawned)) ent.despawn()
        for (const ent of gameState.entities.filter(e => e.spawned && e.active)) ent.update(t / 1000, dt / 1000)
        for (const ent of gameState.entities.filter(e => e.spawned && e.active)) ent.postUpdate()
        this.text.setText(`Power: ${gameState.player.power}/${gameState.player.maxPower} Schematics: ${gameState.player.schematics.map((s, i) => {
            let str = s ? `${s.name}:${s.cost}` : `empty`
            if (i === gameState.player.schematicIndex) str = `(${str})`
            return str
        }).join(' ')}\n${gameState.player.mapX}, ${gameState.player.mapY}`)

        const tick = Math.floor(t / gameState.tickRate) * gameState.tickRate
        if (t / gameState.tickRate >= tick && t - dt <= tick) {
            if (!gameState.music.isPlaying) gameState.music.play()
        }
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
