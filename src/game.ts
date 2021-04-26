import 'phaser'
import { Scene } from 'phaser'

const DEBUG = false

type Facing4Way = 'up' | 'right' | 'down' | 'left'
type Facing8Way = 'center-center' | 'up-left' | 'up-center' | 'up-right' | 'center-right' | 'down-right' | 'down-center' | 'down-left' | 'center-left'

const FACING_4WAY: Facing4Way[] = ['up', 'right', 'down', 'left']
const FACING_8WAY: Facing8Way[] = ['up-left', 'up-center', 'up-right', 'center-right', 'down-right', 'down-center', 'down-left', 'center-left']

enum IconType {
    gun = 0,
    multishot = 1,
    tracking = 2,
    punch = 3,
    boomerang = 4,
    directionalGun = 5,
    directionalMulti = 6,
    directionlTracking = 7,

    length,
}

window.onerror = (msg, src, line, col, err) => {
    if (!DEBUG) {
        alert(`Please screenshot this and report it!\n${msg}\nin ${src}:(${line},${col})`)
    }
    console.error(err)
}

function rand(max: number, min: number = 0) {
    return min + Math.floor((max + 1 - min) * Math.random())
}

function randItem<T>(array: T[]): T | null {
    if (array.length === 0) return null
    return array[rand(array.length - 1)]
}

function shuffle<T>(array: T[]): T[] {
    const a = [...array]
    for (let i = a.length - 1; i > 0; i--) {
        const j = rand(i);
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

function dist(a: { x: number, y: number }, b: { x: number, y: number }) {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
}

function get3dSound(ent: { x: number, y: number }) {
    return { pan: Math.min(1, Math.max(-1, (ent.x - gameState.player.x) / 320)), volume: 1 - Math.min(1, Math.max(dist(ent, gameState.player) / 320)) }
}

function destroyComponent<T extends { destroy(): void }>(c: T): T {
    c?.destroy()
    return null as any as T
}

export class DroneSchematic {
    constructor(public name: string, public cost: number, public icon: IconType, public create: (creator: Player, schematic: DroneSchematic) => DroneBase) {

    }
}

export const droneSchematics = [
    new DroneSchematic('Turret', 10, IconType.gun, (p, s) => new DroneGun(p.floorIndex, p.x, p.y, p.facing, s)),
    new DroneSchematic('Puncher', 15, IconType.punch, (p, s) => new DroneHoverPunch(p.floorIndex, p.x, p.y, p.facing, s)),
    new DroneSchematic('Boomerang', 15, IconType.boomerang, (p, s) => new DroneSpinBoomerang(p.floorIndex, p.x, p.y, p.facing, s)),
    new DroneSchematic('Tracker', 15, IconType.tracking, (p, s) => new DroneTracker(p.floorIndex, p.x, p.y, p.facing, s)),
    new DroneSchematic('Strafer', 15, IconType.directionalGun, (p, s) => new DroneDirectionalGun(p.floorIndex, p.x, p.y, p.facing, s)),
]

export class EnemySchematic {

    constructor(public name: string, public cost: number, public create: (floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) => EnemyBase) {

    }
}

export const enemySchematics = [
    new EnemySchematic('Turret', 10, (f, x, y, facing, s) => new EnemyGun(f, x, y, facing, s)),
    new EnemySchematic('Hover Turret', 15, (f, x, y, facing, s) => new EnemyHoverGun(f, x, y, facing, s)),
    new EnemySchematic('Spin Boomerang', 15, (f, x, y, facing, s) => new EnemySpinBoomerang(f, x, y, facing, s)),
    new EnemySchematic('Directional Turret', 15, (f, x, y, facing, s) => new EnemyDirectionalGun(f, x, y, facing, s)),
    new EnemySchematic('Hover Puncher', 20, (f, x, y, facing, s) => new EnemyHoverPunch(f, x, y, facing, s)),
    new EnemySchematic('Multishot Turret', 20, (f, x, y, facing, s) => new EnemyMultishot(f, x, y, facing, s)),
    new EnemySchematic('Hover Multishot', 25, (f, x, y, facing, s) => new EnemyHoverMultishot(f, x, y, facing, s)),
]

export const bossSchematic = new EnemySchematic('Boss', Infinity, (f, x, y) => new EnemyBoss(f, x, y))

export abstract class EntityBase {
    active: boolean = false
    initialized: boolean = false
    spawned: boolean = false
    scene!: Phaser.Scene

    constructor(public floorIndex: number) {

    }

    get floor() { return gameState.floors[this.floorIndex] }
    get isOnCurrentFloor() {
        return this.floorIndex === gameState.player.floorIndex
    }

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

export abstract class ElementBase extends EntityBase {
    abstract get screenX(): number
    abstract get screenY(): number

    constructor() {
        super(-1)
    }
}

export abstract class PowerBarBase extends ElementBase {
    sprites: Phaser.GameObjects.Sprite[] = []

    get isOnCurrentFloor() { return this.target?.isOnCurrentFloor ?? false }

    abstract get spriteKey(): string
    abstract get target(): UnitBase | undefined

    despawn() {
        super.despawn()
        while (this.sprites.length) destroyComponent(this.sprites.pop()!)
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        const count = this.target ? Math.ceil(this.target.maxPower / 10) : 0
        while (this.sprites.length > count) destroyComponent(this.sprites.pop()!)
        for (let i = 0; i < count; i++) {
            while (this.sprites.length <= i)
                this.sprites.push(this.scene.add.sprite(0, 0, this.spriteKey))

            const val = this.target ? this.target.power - i * 10 : 0
            const col = i === 0 ? 0 : i === count - 1 ? 2 : 1
            const row = val >= 10 ? 0 : val >= 5 ? 1 : 2
            this.sprites[i].setFrame(row * 3 + col)
            this.sprites[i].setScrollFactor(0, 0)
            this.sprites[i].setPosition(this.screenX + i * 16 + 12, this.screenY + 8)
            this.sprites[i].setDepth(9900)
        }
    }
}

export class PlayerPowerBar extends PowerBarBase {
    text!: Phaser.GameObjects.Text

    get spriteKey() { return 'power-bar-player' }
    get screenX() { return 0 }
    get screenY() { return 0 }
    get target() { return gameState.player }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.text = this.scene.add.text(this.screenX + 4, this.screenY + 12, '', { color: 'white', fontSize: '12px', fontFamily: 'sans-serif' })
        this.text.setDepth(9999)
        this.text.setScrollFactor(0, 0)
        this.text.setOrigin(0, 0)
    }

    despawn() {
        super.despawn()
        this.text = destroyComponent(this.text)
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.text.setText(`Power: ${this.target.power} / ${this.target?.maxPower}`)
    }
}

export class BossPowerBar extends PowerBarBase {

    get spriteKey() { return 'power-bar-boss' }
    get screenX() { return 640 / 2 - (this.target?.maxPower ?? 0) / 10 * 8 - 6 }
    get screenY() { return 480 - 192 }
    get target() { return gameState.enemies.find(e => e.active && e.isOnCurrentFloor && e instanceof EnemyBoss && (!e.isInvulnerable || e.hurtTime > 0)) }
}

export class SchematicList extends ElementBase {
    text!: Phaser.GameObjects.Text
    boxSprites: Phaser.GameObjects.Sprite[] = []
    iconSprites: Phaser.GameObjects.Sprite[] = []

    get screenX() { return 4 }
    get screenY() { return 44 }
    get isOnCurrentFloor() { return true }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.text = this.scene.add.text(this.screenX, this.screenY + 16, '', { color: 'white', fontSize: '12px', fontFamily: 'sans-serif' })
        this.text.setDepth(9999)
        this.text.setScrollFactor(0, 0)
        this.text.setOrigin(0, 0)
    }

    despawn() {
        super.despawn()
        this.text = destroyComponent(this.text)
        while (this.boxSprites.length) destroyComponent(this.boxSprites.pop()!)
        while (this.iconSprites.length) destroyComponent(this.iconSprites.pop()!)
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        const count = gameState.player.schematics.length
        while (this.boxSprites.length > count) destroyComponent(this.boxSprites.pop()!)
        while (this.iconSprites.length > count) destroyComponent(this.iconSprites.pop()!)
        for (let i = 0; i < count; i++) {
            while (this.boxSprites.length <= i)
                this.boxSprites.push(this.scene.add.sprite(0, 0, 'ui-schematic-box'))
            while (this.iconSprites.length <= i)
                this.iconSprites.push(this.scene.add.sprite(0, 0, 'ui-schematic-icon'))

            this.boxSprites[i].setDepth(9998)
            this.boxSprites[i].setScrollFactor(0, 0)

            this.iconSprites[i].setDepth(9998)
            this.iconSprites[i].setScrollFactor(0, 0)

            this.boxSprites[i].setPosition(this.screenX + 16 + 36 * i, this.screenY)
            this.iconSprites[i].setPosition(this.screenX + 16 + 36 * i, this.screenY)

            this.boxSprites[i].setFrame(i === gameState.player.schematicIndex ? 0 : 1)

            const s = gameState.player.schematics[i]
            if (s) {
                const deployed = gameState.drones.some(d => d.schematic === s)
                const canAfford = gameState.player.power > s.cost
                const row = deployed ? 2 : canAfford ? 0 : 1
                this.iconSprites[i].setFrame(IconType.length * row + s.icon)
            }
            this.iconSprites[i].setVisible(!!s)
        }
        this.text.setText(gameState.player.schematics[gameState.player.schematicIndex]?.name ?? '')
    }
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

    hasSpawnedObjects: boolean = false

    hasOpenedBossRoom: boolean = false
    hasOpenedBossElevator: boolean = false

    roomUpLeftType: number = -1
    roomUpCenterType: number = -1
    roomUpRightType: number = -1
    roomCenterRightType: number = -1
    roomDownRightType: number = -1
    roomDownCenterType: number = -1
    roomDownLeftType: number = -1
    roomCenterLeftType: number = -1

    get hasRoomUpLeft() { return this.roomUpLeftType >= 0 }
    get hasRoomUpCenter() { return this.roomUpCenterType >= 0 || this.isBossFloor }
    get hasRoomUpRight() { return this.roomUpRightType >= 0 }
    get hasRoomCenterRight() { return this.roomCenterRightType >= 0 }
    get hasRoomDownRight() { return this.roomDownRightType >= 0 }
    get hasRoomDownCenter() { return this.roomDownCenterType >= 0 }
    get hasRoomDownLeft() { return this.roomDownLeftType >= 0 }
    get hasRoomCenterLeft() { return this.roomCenterLeftType >= 0 }

    get floorNumber() { return this.floorIndex % 5 }
    get isTopFloor() { return this.floorNumber === 0 }
    get isBossFloor() { return this.floorNumber === 4 }

    constructor(floorIndex: number) {
        super(floorIndex)
    }

    initialize() {
        super.initialize()

        this.roomUpCenterType = this.randomRoomType()
        this.roomCenterRightType = this.randomRoomType()
        this.roomDownCenterType = this.randomRoomType()
        this.roomCenterLeftType = this.randomRoomType()

        if (this.hasRoomCenterLeft || this.hasRoomUpCenter) this.roomUpLeftType = this.randomRoomType()
        if (this.hasRoomUpCenter || this.hasRoomCenterRight) this.roomUpRightType = this.randomRoomType()
        if (this.hasRoomCenterRight || this.hasRoomDownCenter) this.roomDownRightType = this.randomRoomType()
        if (this.hasRoomDownCenter || this.hasRoomCenterLeft) this.roomDownLeftType = this.randomRoomType()
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
        this.fgLayer.setCollisionByExclusion([-1])

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
            this.copyRect(0, 92, 4, 0, 16, 32)
        } else {
            this.clearRect(0, 0, 24, 32)
        }

        this.setRoom(52, this.roomUpLeftType, 0, 24, null, this.hasRoomUpCenter, this.hasRoomCenterLeft, null)
        if (!this.isBossFloor) {
            this.setRoom(60, this.roomUpCenterType, 8, 24, null, this.hasRoomUpRight, true, this.hasRoomUpLeft)
        }
        this.setRoom(68, this.roomUpRightType, 16, 24, null, null, this.hasRoomCenterRight, this.hasRoomUpCenter)
        this.setRoom(76, this.roomCenterRightType, 16, 32, this.hasRoomUpRight, null, this.hasRoomDownRight, true)
        this.setRoom(84, this.roomDownRightType, 16, 40, this.hasRoomCenterRight, null, null, this.hasRoomDownCenter)
        this.setRoom(92, this.roomDownCenterType, 8, 40, true, this.hasRoomDownRight, null, this.hasRoomDownLeft)
        this.setRoom(100, this.roomDownLeftType, 0, 40, this.hasRoomCenterLeft, this.hasRoomDownCenter, null, null)
        this.setRoom(108, this.roomCenterLeftType, 0, 32, this.hasRoomUpLeft, true, this.hasRoomDownLeft, null)

        this.setRoomDoors(8, 32, this.hasRoomUpCenter, this.hasRoomCenterRight, this.hasRoomDownCenter, this.hasRoomCenterLeft)

        if (!this.hasSpawnedObjects) {
            if (!this.isBossFloor)
                gameState.interactibles.push(new InteractableElevatorButton(this.floorIndex, -64, -80, 1, true))
            if (!this.isTopFloor)
                gameState.interactibles.push(new InteractableElevatorButton(this.floorIndex, 64, -80, -1, true))
            if (this.isBossFloor) {
                gameState.interactibles.push(new InteractableElevatorButton(this.floorIndex, -64, -1104, 1, false))
                gameState.pylons.push(new Pylon(this.floorIndex, -16, -268, false))
                gameState.pylons.push(new Pylon(this.floorIndex, 16, -268, false))
                gameState.pylons.push(new Pylon(this.floorIndex, -16, -236, false))
                gameState.pylons.push(new Pylon(this.floorIndex, 16, -236, false))
                gameState.pylons.push(new Pylon(this.floorIndex, -112, -524, true))
                gameState.pylons.push(new Pylon(this.floorIndex, 112, -524, true))
                gameState.pylons.push(new Pylon(this.floorIndex, -112, -748, true))
                gameState.pylons.push(new Pylon(this.floorIndex, 112, -748, true))
                gameState.enemies.push(new EnemyBoss(this.floorIndex, 0, -638))

            }
            this.hasSpawnedObjects = true
        }

        if (DEBUG) {
            this.debugGrid = this.scene.add.grid(0, 0, 1024, 1024, 32, 32, undefined, undefined, 0xFF00FF, 0.25)
            this.debugGfx = this.scene.add.graphics({ x: 0, y: 0 })
            this.debugLayer = this.fgLayer.renderDebug(this.debugGfx)
        }

        this.collider = this.scene.physics.add.collider([gameState.playerGroup, gameState.droneGroup, gameState.enemyGroup, gameState.bulletGroup], this.fgLayer, other => {
            if (!other || !other.body) return
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
        this.map = destroyComponent(this.map)
        this.bgLayer = destroyComponent(this.bgLayer)
        this.fgLayer = destroyComponent(this.fgLayer)
        this.debugGrid = destroyComponent(this.debugGrid)
        this.debugGfx = destroyComponent(this.debugGfx)
        this.debugLayer = destroyComponent(this.debugLayer)
        this.collider = destroyComponent(this.collider)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return

        if (this.isBossFloor && this.hasSpawnedObjects) {
            const shouldOpenBossRoom = gameState.pylons.filter(p => p.floorIndex === this.floorIndex && !p.boss).every(p => p.isPowered)
            if (shouldOpenBossRoom && !this.hasOpenedBossRoom) {
                this.hasOpenedBossRoom = true
                this.setVerticalDoor(11, 23, true)
                this.setVerticalDoor(11, 24, true)
            }
            const shouldOpenBossElevator = gameState.enemies.filter(p => p.floorIndex === this.floorIndex && p instanceof EnemyBoss).length === 0
            if (shouldOpenBossElevator && !this.hasOpenedBossElevator) {
                this.hasOpenedBossElevator = true
                this.setVerticalDoor(11, 7, true)
                this.setVerticalDoor(11, 8, true)
            }
        }
    }

    private spawnRoom(sx: number, sy: number) {
        const tiles = shuffle(this.getEmptyTiles(sx + 1, sy + 1, 8 - 2, 8 - 2))
        const powerCores = rand(0, 2)
        let enemyBudget = rand(0, 3 + this.floorIndex) * 10
        while (enemyBudget > 0 && tiles.length) {
            const { x, y } = tiles.pop()!
            const schematic = randItem(enemySchematics.filter(s => s.cost <= enemyBudget))
            if (!schematic) break
            enemyBudget -= schematic.cost
            gameState.enemies.push(schematic.create(this.floorIndex, x, y, randItem(FACING_4WAY)!, schematic))
        }
        for (let i = 0; i < powerCores && tiles.length; i++) {
            const { x, y } = tiles.pop()!
            gameState.interactibles.push(new InteractablePowerCore(this.floorIndex, x, y))
        }
    }

    public getEmptyTiles(sx: number, sy: number, w: number, h: number) {
        const values = []
        for (let x = sx; x < sx + w; x++) {
            for (let y = sy; y < sy + h; y++) {
                const t = this.fgLayer.getTileAt(x, y, true)
                if (t.index === -1) values.push({ x: t.getCenterX(), y: t.getCenterY(), tx: x, ty: y })
            }
        }
        return values
    }

    private setRoom(sx: number, type: number, dx: number, dy: number, neighborUp: boolean | null, neighborRight: boolean | null, neighborDown: boolean | null, neighborLeft: boolean | null) {
        if (type >= 0) {
            this.copyRoom(sx, type * 8, dx, dy)
            this.setRoomDoors(dx, dy, neighborUp, neighborRight, neighborDown, neighborLeft)
            if (!this.hasSpawnedObjects) this.spawnRoom(dx, dy)
        } else {
            this.clearRoom(dx, dy)
        }
    }

    private setRoomDoors(dx: number, dy: number, neighborUp: boolean | null, neighborRight: boolean | null, neighborDown: boolean | null, neighborLeft: boolean | null) {
        if (neighborUp !== null) this.setVerticalDoor(dx + 3, dy + 0, neighborUp)
        if (neighborDown !== null) this.setVerticalDoor(dx + 3, dy + 7, neighborDown)
        if (neighborLeft !== null) this.setHorizontalDoor(dx + 0, dy + 3, neighborLeft)
        if (neighborRight !== null) this.setHorizontalDoor(dx + 7, dy + 3, neighborRight)
    }

    private setHorizontalDoor(dx: number, dy: number, open: boolean) {
        this.setTile(dx + 0, dy + 0, open ? -1 : 166, open ? 162 : -1)
        this.setTile(dx + 0, dy + 1, open ? -1 : 167, open ? 163 : -1)
    }

    private setVerticalDoor(dx: number, dy: number, open: boolean) {
        this.setTile(dx + 0, dy + 0, open ? -1 : 164, open ? 160 : -1)
        this.setTile(dx + 1, dy + 0, open ? -1 : 165, open ? 161 : -1)
    }


    private copyRoom(sx: number, sy: number, dx: number, dy: number) {
        return this.copyRect(sx, sy, dx, dy, 8, 8)
    }

    private clearRoom(dx: number, dy: number) {
        return this.clearRect(dx, dy, 8, 8)
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

    private randomRoomType() {
        return !this.isBossFloor && Math.random() < (0.25 + 0.2 * this.floorNumber) ? rand(3) : -1
    }
}

export abstract class ActorBase extends EntityBase {
    sprite!: Phaser.GameObjects.Sprite
    shadowSprite!: Phaser.GameObjects.Sprite

    constructor(floorIndex: number, public x: number, public y: number) {
        super(floorIndex)
    }

    abstract get spriteKey(): string
    abstract get shadowOffset(): number

    get body() { return this.sprite.body as Phaser.Physics.Arcade.Body }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.sprite = scene.physics.add.sprite(this.x, this.y, this.spriteKey, 0)
        this.shadowSprite = this.scene.add.sprite(this.x, this.y, 'drop-shadow')
    }

    despawn() {
        super.despawn()
        this.sprite = destroyComponent(this.sprite)
        this.shadowSprite = destroyComponent(this.shadowSprite)
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.x = this.sprite.x
        this.y = this.sprite.y
        this.sprite.setDepth(this.y)
        this.shadowSprite.setPosition(this.sprite.x, this.sprite.y + this.shadowOffset)
        this.shadowSprite.setDepth(this.sprite.depth - 1)
        this.shadowSprite.setVisible(this.sprite.visible)
    }
}

export abstract class UnitBase extends ActorBase {
    hurtTime: number = 0
    hurtDirX: number = 0
    hurtDirY: number = 0
    facing: 'up' | 'right' | 'down' | 'left' = 'down'
    dead: boolean = false

    get tileX() { return this.x / 32 + 0.5 }
    get tileY() { return this.y / 32 + 0.5 }
    get mapX() { return this.floor.fgLayer.getTileAtWorldXY(this.x, this.y, true).x }
    get mapY() { return this.floor.fgLayer.getTileAtWorldXY(this.x, this.y, true).y }

    get isInvulnerable() { return this.hurtTime > 0 }

    abstract get invulnPeriod(): number
    abstract get movementType(): 'stationary' | 'hovering' | 'spinning' | 'directional' | 'boss'

    get shadowOffset() { return this.movementType === 'stationary' ? -2 : 6 }

    constructor(floorIndex: number, x: number, y: number, public power: number, public maxPower: number = power) {
        super(floorIndex, x, y)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.body.setSize(24, 24)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        this.hurtTime -= dt
        this.sprite.tint = this.hurtTime > 0 && Math.sin(t * Math.PI * 16) > 0 ? 0xFF0000 : 0xFFFFFF
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        if (this.power <= 0 && !this.dead) this.die()
    }

    hurt(damage: number, inflictor: ActorBase) {
        if (!this.isInvulnerable && !this.dead) {
            const dmg = Math.min(this.power, damage)
            if (dmg > 0) {
                this.power -= dmg
                this.hurtTime = this.invulnPeriod
                const dir = new Phaser.Math.Vector2(this.x - inflictor.x, this.y - inflictor.y).normalize()
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
    schematics: (DroneSchematic | null)[] = [droneSchematics[0]]
    schematicIndex: number = 0

    get spriteKey() { return 'player' }
    get movementType() { return 'hovering' as const }
    get invulnPeriod() { return 1 }

    constructor() {
        super(0, 0, 0, 100, 100)
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
        this.body.setSize(20, 20)
        gameState.playerGroup.add(this.sprite)
    }

    despawn() {
        super.despawn()
        gameState.playerGroup.remove(this.sprite)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active || this.dead) return
        const speed = 128
        let vx = 0
        let vy = 0

        if (gameState.keys.a.isDown || gameState.keys.left.isDown) vx -= 1
        if (gameState.keys.d.isDown || gameState.keys.right.isDown) vx += 1
        if (gameState.keys.w.isDown || gameState.keys.up.isDown) vy -= 1
        if (gameState.keys.s.isDown || gameState.keys.down.isDown) vy += 1
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

        if (gameState.keys.space.isDown && !this.placing) {
            this.placing = true

            const target = this.getTargetForInteract()

            if (target instanceof DroneBase) {
                const refund = Math.min(this.maxPower - this.power, target.power)
                this.power += refund
                target.destroy()
            } else if (target instanceof InteractableBase) {
                target.interact()
            } else if (target instanceof DroneSchematic) {
                if (!gameState.pylons.some(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered))
                    this.power -= target.cost
                const drone = target.create(this, target)
                gameState.drones.push(drone)
            }
        }
        if (!gameState.keys.space.isDown && this.placing) this.placing = false

        if ((gameState.keys.shift.isDown || gameState.keys.tab.isDown) && !this.swapping) {
            this.swapping = true
            this.schematicIndex = (this.schematicIndex + 1) % this.schematics.length
        }
        if (!(gameState.keys.shift.isDown || gameState.keys.tab.isDown) && this.swapping) this.swapping = false
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

    getTargetForInteract() {
        const d = gameState.drones.filter(d => d.active && d.isOnCurrentFloor && dist(this.sprite, d) < 20).sort((a, b) => dist(this.sprite, a) - dist(this.sprite, b))[0]
        if (d) return d

        const i = gameState.interactibles.filter(i => i.active && i.isOnCurrentFloor && dist(this.sprite, i) < 20).sort((a, b) => dist(this.sprite, a) - dist(this.sprite, b))[0]
        if (i) return i

        const s = this.schematics[this.schematicIndex]
        if (s && this.power > s.cost && !gameState.drones.some(d => d.schematic === s)) return s
    }
}

export abstract class DroneLikeBase extends UnitBase {
    attachSprite!: Phaser.GameObjects.Sprite
    barSprite!: Phaser.GameObjects.Sprite

    abstract get attachSpriteKey(): string

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, power: number, public impactDamage: number) {
        super(floorIndex, x, y, power)
        this.facing = facing
    }

    initialize() {
        super.initialize()
        if (this.movementType === 'boss') {
            this.scene.anims.create({ key: `drone-up-boss-invulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-invulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-boss-invulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-invulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-boss-invulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-invulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-boss-invulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-invulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })

            this.scene.anims.create({ key: `drone-up-boss-vulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-vulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-boss-vulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-vulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-boss-vulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-vulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-boss-vulnerable`, frames: this.scene.anims.generateFrameNumbers('boss-vulnerable', { start: 0, end: 3 }), frameRate: 5, repeat: -1 })

            this.scene.anims.create({ key: `drone-up-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-right-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-down-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
            this.scene.anims.create({ key: `drone-left-${this.attachSpriteKey}`, frames: this.scene.anims.generateFrameNumbers(this.attachSpriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
        } else if (this.movementType === 'hovering' || this.movementType === 'directional') {
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
        this.attachSprite = destroyComponent(this.attachSprite)
        this.barSprite = destroyComponent(this.barSprite)
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

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, impactDamage: number, public schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, schematic.cost, impactDamage)
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
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        gameState.drones.splice(gameState.drones.indexOf(this), 1)
    }

    tick() {
        super.tick()
        if (!gameState.pylons.some(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered))
            this.power--
    }
}

export class DroneGun extends DroneBase {
    get attachSpriteKey() { return 'drone-gun' }
    get movementType() { return 'stationary' as const }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, 0, schematic)
    }

    tick() {
        super.tick()
        const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, true, 5))
    }
}

export class DroneTracker extends DroneBase {
    subtick: number = 0

    get attachSpriteKey() { return 'drone-tracking' }
    get movementType() { return 'stationary' as const }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, 0, schematic)
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
            gameState.bullets.push(new BulletTracker(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, true, 15))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class DroneHoverPunch extends DroneBase {
    collisionDebounce: number = 0

    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'drone-punch-hover' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, 10, schematic)
    }

    tick() {
        super.tick()
        this.recalculateVelocity()
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

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, 15, schematic)
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

export class DroneDirectionalGun extends DroneBase {
    moveFacing: Facing4Way = 'up'
    collisionDebounce: number = 0

    get movementType() { return 'directional' as const }
    get attachSpriteKey() { return 'drone-gun-hover' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, 5, schematic)
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
        gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, true, 5))
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

export abstract class EnemyBase extends DroneLikeBase {
    collider!: Phaser.Physics.Arcade.Collider

    get spriteKey() {
        return this.movementType === 'boss' ? (this.isInvulnerable ? 'boss-invulnerable' : 'boss-vulnerable') :
            this.movementType === 'hovering' ? 'enemy-core-hover' :
                this.movementType === 'spinning' ? 'enemy-core-spin' :
                    this.movementType === 'directional' ? 'enemy-core-directional' :
                        'enemy-core'
    }
    get invulnPeriod() { return 0.25 }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, power: number, impactDamage: number, public schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, power, impactDamage)
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
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        gameState.enemies.splice(gameState.enemies.indexOf(this), 1)
    }

    die(skipPickups?: boolean) {
        super.die()
        if (!skipPickups) {
            if (Math.random() < 0.1) {
                const choices = droneSchematics.filter(s => !gameState.player.schematics.includes(s))
                if (choices.length) gameState.drops.push(new DropSchematic(this.floorIndex, this.x, this.y, randItem(choices)!))
            } else {
                gameState.drops.push(new DropPower(this.floorIndex, this.x, this.y, 10))
            }
        }
        this.destroy()
    }
}

export class EnemyBoss extends EnemyBase {
    subtick: number = 0

    get movementType() { return 'boss' as const }
    get attachSpriteKey() { return 'transparent' }
    get isInvulnerable() { return this.hurtTime > 0 || !gameState.pylons.filter(p => p.floorIndex === this.floorIndex && p.boss).every(p => p.isPowered) }

    constructor(floorIndex: number, x: number, y: number) {
        super(floorIndex, x, y, 'down', 100, 10, bossSchematic)
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.body.setSize(60, 60)
    }

    tick() {
        super.tick()
        if (!this.active || !this.floor.hasOpenedBossRoom) return
        if ((this.subtick % 4) === 0) {
            this.body.setVelocity(rand(1, -1) * 64, rand(1, -1) * 64)
        } else {
            this.body.setVelocity(0, 0)
        }
        if (this.subtick === 16) {
            const pylonsActive = gameState.pylons.filter(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered).length
            let enemyBudget = rand(1, 1 + pylonsActive) * 10
            const tiles = this.floor.getEmptyTiles(this.mapX - 1, this.mapY - 1, 3, 3).filter(t => !gameState.enemies.some(e => e.floorIndex === this.floorIndex && e.mapX === t.tx && e.mapY === t.ty))
            while (enemyBudget > 0 && tiles.length) {
                const { x, y } = tiles.pop()!
                const schematic = randItem(enemySchematics.filter(s => s.cost <= enemyBudget))
                if (!schematic) break
                enemyBudget -= schematic.cost
                gameState.enemies.push(schematic.create(this.floorIndex, x, y, randItem(FACING_4WAY)!, schematic))
            }
            this.subtick = 0
        } else {
            this.subtick++
        }
    }

    die() {
        super.die(true)
        for (const e of gameState.enemies.filter(e => e.floorIndex === this.floorIndex)) e.power = 0
    }
}

export class EnemyGun extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'stationary' as const }
    get attachSpriteKey() { return 'enemy-gun' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 15, 5, schematic)
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
            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyMultishot extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'stationary' as const }
    get attachSpriteKey() { return 'enemy-multishot' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 20, 5, schematic)
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

            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx + ox, dy + oy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx - ox, dy - oy, 256, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyHoverGun extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'enemy-gun-hover' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 20, 5, schematic)
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
            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyHoverMultishot extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'enemy-multishot-hover' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 25, 5, schematic)
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

            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx + ox, dy + oy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 256, 2, false, 5))
            gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx - ox, dy - oy, 256, 2, false, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}

export class EnemyHoverPunch extends EnemyBase {
    subtick: number = 0
    get movementType() { return 'hovering' as const }
    get attachSpriteKey() { return 'enemy-punch-hover' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 20, 10, schematic)
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

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 20, 10, schematic)
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

export class EnemyDirectionalGun extends EnemyBase {
    moveFacing: Facing4Way = 'up'
    collisionDebounce: number = 0

    get movementType() { return 'directional' as const }
    get attachSpriteKey() { return 'enemy-gun-hover' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) {
        super(floorIndex, x, y, facing, 10, 5, schematic)
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
        gameState.bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, false, 5))
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

    get shadowOffset() { return 4 }

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
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        gameState.drops.splice(gameState.drops.indexOf(this), 1)
    }

    abstract pickup(): boolean | undefined
}

export class DropPower extends DropBase {

    constructor(floorIndex: number, x: number, y: number, public power: number) {
        super(floorIndex, x, y)
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

    constructor(floorIndex: number, x: number, y: number, public schematic: DroneSchematic) {
        super(floorIndex, x, y)
    }

    get spriteKey() { return 'pickup-schematic' }

    pickup() {
        if (gameState.player.schematics.some(s => s === this.schematic)) return
        /*
        const slotIndex = gameState.player.schematics.findIndex(s => s === null)
        if (slotIndex === -1) return
        gameState.player.schematics[slotIndex] = this.schematic
        */
        gameState.player.schematics.push(this.schematic)
        return true
    }
}

export abstract class BulletBase extends ActorBase {
    collider!: Phaser.Physics.Arcade.Collider

    get shadowOffset() { return 4 }

    constructor(floorIndex: number, x: number, y: number, public dx: number, public dy: number, public speed: number, public lifetime: number, public friendly: boolean) {
        super(floorIndex, x, y)
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
        this.collider = destroyComponent(this.collider)
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

    constructor(floorIndex: number, x: number, y: number, dx: number, dy: number, speed: number, lifetime: number, friendly: boolean, public damage: number) {
        super(floorIndex, x, y, dx, dy, speed, lifetime, friendly)
    }

    hit(target: Player | DroneBase | EnemyBase) {
        if (this.friendly === (target instanceof Player || target instanceof DroneBase)) return
        target.hurt(this.damage, this)
        return true
    }
}

export class BulletTracker extends BulletBase {
    trackingTime: number = 0.125

    get spriteKey() { return this.friendly ? 'projectile-ally-tracking' : 'projectile-enemy-tracking' }

    constructor(floorIndex: number, x: number, y: number, dx: number, dy: number, friendly: boolean, public damage: number) {
        super(floorIndex, x, y, dx, dy, 192, 5, friendly)
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

    abstract get actionText(): string

    destroy() {
        super.destroy()
        gameState.interactibles.splice(gameState.interactibles.indexOf(this), 1)
    }

    abstract interact(): void
}

export class InteractablePowerCore extends InteractableBase {
    power: number = 25

    get spriteKey() { return 'interactable-power-core' }
    get shadowOffset() { return 4 }
    get actionText() {
        return gameState.player.power < gameState.player.maxPower ?
            `Pick up power core (+${this.power} power)` :
            `Cannot pick up power core (already at max power)`
    }

    interact() {
        if (gameState.player.power < gameState.player.maxPower) {
            const delta = Math.min(gameState.player.maxPower - gameState.player.power, this.power)
            gameState.player.power += delta
            gameState.powerUpSound.play(get3dSound(this))
            this.destroy()
        }
    }
}

export class InteractableElevatorButton extends InteractableBase {

    get spriteKey() { return 'interactable-arrows' }
    get shadowOffset() { return 0 }
    get actionText() {
        return this.isValidOnFloor() ?
            (this.isUnlocked() ?
                `Take elevator ${this.delta === 1 ? 'down' : 'up'}` :
                `Cannot take elevator (locked by enemies)`) :
            `Cannot take elevator ${this.delta === 1 ? 'down' : 'up'}`
    }

    constructor(floorIndex: number, x: number, y: number, public delta: -1 | 1, public main: boolean) {
        super(floorIndex, x, y)
    }

    initialize() {
        super.initialize()
        this.scene.anims.create({ key: 'elevator-button-down', frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 0, end: 3 }), frameRate: 5, repeat: -1 })
        this.scene.anims.create({ key: 'elevator-button-up', frames: this.scene.anims.generateFrameNumbers(this.spriteKey, { start: 4, end: 7 }), frameRate: 5, repeat: -1 })
    }

    interact() {
        if (this.isValidOnFloor() && this.isUnlocked()) {
            gameState.player.floorIndex += this.delta
            for (const d of gameState.drones) d.destroy()
            gameState.player.sprite.setPosition(0, 0)
        }
    }

    postUpdate() {
        super.postUpdate()
        this.sprite.anims.play(`elevator-button-${this.delta === 1 ? 'down' : 'up'}`, true)
        this.sprite.setVisible(this.isValidOnFloor() && this.isUnlocked())
    }

    private isUnlocked(): boolean {
        if (this.delta === -1) return true
        const noEnemies = gameState.enemies.filter(e => e.floorIndex === this.floorIndex && !e.dead).length === 0
        return noEnemies
    }

    private isValidOnFloor(): boolean {
        if (this.main) {
            if (this.delta === -1) return !this.floor.isTopFloor
            if (this.delta === 1) return !this.floor.isBossFloor
        } else {
            if (this.delta === -1) return false
            if (this.delta === 1) return true
        }
        return false
    }
}

export class Pylon extends ActorBase {
    progress: number = 0
    power: number = 0
    maxPower: number = 9

    get spriteKey() { return 'pylon' }
    get shadowOffset() { return 8 }

    get isPowered() { return this.power >= this.maxPower }

    constructor(floorIndex: number, x: number, y: number, public boss: boolean) {
        super(floorIndex, x, y)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active || gameState.player.floorIndex !== this.floorIndex) return
        const dx = Math.abs(gameState.player.x - this.x)
        const dy = Math.abs(gameState.player.y - this.y)
        if (dx < 48 && dy < 48) {
            if (!this.isPowered) this.progress += dt * (this.boss ? 1.5 : 2)
            while (this.progress > 1) {
                this.progress--
                this.power = Math.min(this.maxPower, this.power + 1)
                if (this.power === this.maxPower) {
                    gameState.powerUpSound.play(get3dSound(this))
                } else {
                    gameState.clickSound.play(get3dSound(this))
                }
            }
        }
    }

    postUpdate() {
        super.postUpdate()
        this.sprite.setFrame(Math.floor(this.power))
    }
}

export class GameState {
    player: Player = new Player()
    drones: DroneBase[] = []
    enemies: EnemyBase[] = []
    drops: DropBase[] = []
    bullets: BulletBase[] = []
    interactibles: InteractableBase[] = []
    pylons: Pylon[] = []
    elements: ElementBase[] = [new PlayerPowerBar(), new BossPowerBar(), new SchematicList()]
    floors: Floor[] = []

    tickRate: number = 0.5

    playerGroup!: Phaser.GameObjects.Group
    droneGroup!: Phaser.GameObjects.Group
    enemyGroup!: Phaser.GameObjects.Group
    dropGroup!: Phaser.GameObjects.Group
    bulletGroup!: Phaser.GameObjects.Group

    normalMusic!: Phaser.Sound.BaseSound
    bossMusic!: Phaser.Sound.BaseSound
    bumpSound!: Phaser.Sound.BaseSound
    damageSound!: Phaser.Sound.BaseSound
    shootSound!: Phaser.Sound.BaseSound
    powerUpSound!: Phaser.Sound.BaseSound
    clickSound!: Phaser.Sound.BaseSound

    keys!: {
        w: Phaser.Input.Keyboard.Key,
        a: Phaser.Input.Keyboard.Key,
        s: Phaser.Input.Keyboard.Key,
        d: Phaser.Input.Keyboard.Key,
        left: Phaser.Input.Keyboard.Key,
        right: Phaser.Input.Keyboard.Key,
        up: Phaser.Input.Keyboard.Key,
        down: Phaser.Input.Keyboard.Key,
        space: Phaser.Input.Keyboard.Key,
        shift: Phaser.Input.Keyboard.Key,
        tab: Phaser.Input.Keyboard.Key,
    }

    get floor() { return this.floors[this.player.floorIndex] }

    get entities() { return [this.player, ...this.drones, ...this.enemies, ...this.drops, ...this.bullets, ...this.interactibles, ...this.pylons, ...this.elements, ...this.floors] }
}

const gameState = new GameState()

export class GameplayScene extends Phaser.Scene {
    text!: Phaser.GameObjects.Text

    constructor() { super('gameplay') }

    init() {
        console.log(gameState)
    }

    preload() {
        this.load.image('placeholder', 'assets/placeholder.png')
        this.load.spritesheet('transparent', 'assets/Transparent.png', { frameWidth: 1 })
        this.load.spritesheet('drop-shadow', 'assets/DropShadow.png', { frameWidth: 32 })

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
        this.load.audio('music-menu', 'assets/underglow.mp3')
        this.load.audio('sound-bump', 'assets/bump.wav')
        this.load.audio('sound-damage', 'assets/damage.wav')
        this.load.audio('sound-shoot', 'assets/laserShoot.wav')
        this.load.audio('sound-power-up', 'assets/powerUp.wav')
        this.load.audio('sound-click', 'assets/click.wav')
    }

    create() {
        gameState.playerGroup = this.physics.add.group()
        gameState.droneGroup = this.physics.add.group()
        gameState.enemyGroup = this.physics.add.group()
        gameState.dropGroup = this.physics.add.group()
        gameState.bulletGroup = this.physics.add.group()
        this.text = this.add.text(0, 360, '', { color: 'white', fontSize: '12px', fontFamily: 'sans-serif' })
        this.text.setDepth(9999)
        this.text.setScrollFactor(0, 0)
        this.text.setOrigin(0, 1)
        gameState.normalMusic = this.sound.add('music-normal')
        gameState.bossMusic = this.sound.add('music-boss')
        gameState.bumpSound = this.sound.add('sound-bump')
        gameState.damageSound = this.sound.add('sound-damage')
        gameState.shootSound = this.sound.add('sound-shoot')
        gameState.powerUpSound = this.sound.add('sound-power-up')
        gameState.clickSound = this.sound.add('sound-click')

        gameState.keys = {
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
        while (gameState.player.floorIndex >= gameState.floors.length) gameState.floors.push(new Floor(gameState.floors.length))
        for (const ent of gameState.entities.filter(e => e.isOnCurrentFloor && !e.spawned)) ent.spawn(this)
        for (const ent of gameState.entities.filter(e => !e.isOnCurrentFloor && e.spawned)) ent.despawn()
        for (const ent of gameState.entities.filter(e => e.spawned && e.active)) ent.update(t / 1000, dt / 1000)
        for (const ent of gameState.entities.filter(e => e.spawned && e.active)) ent.postUpdate()

        this.text.setText(`${this.getContextTargetText()}\n(WASD/Arrow Keys) move | (Shift/Tab) cycle drones`.trim())

        const tick = Math.floor(t / gameState.tickRate) * gameState.tickRate
        if (t / gameState.tickRate >= tick && t - dt <= tick) {
            const playBossMusic = gameState.enemies.some(e => e.isOnCurrentFloor && e.active && e instanceof EnemyBoss) && gameState.floor.hasOpenedBossRoom
            if (!playBossMusic && !gameState.normalMusic.isPlaying) gameState.normalMusic.play()
            if (playBossMusic && !gameState.bossMusic.isPlaying) gameState.bossMusic.play()
            if (playBossMusic && gameState.normalMusic.isPlaying) gameState.normalMusic.stop()
            if (!playBossMusic && gameState.bossMusic.isPlaying) gameState.bossMusic.stop()
        }
    }

    private getContextTargetText() {
        let str = ''
        const target = gameState.player.getTargetForInteract()
        if (target instanceof DroneBase) {
            str = `Pick up ${target.schematic.name} (+${target.power} power)`
        }
        if (target instanceof InteractableBase) {
            str = target.actionText
        }
        if (target instanceof DroneSchematic) {
            str = `Place ${target.name} (-${target.cost} power)`
        }
        return str ? `(Spacebar) ${str}` : ''
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
