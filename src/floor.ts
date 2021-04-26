import { EntityBase } from './base'
import { DEBUG, FACING_4WAY } from './constants'
import { Alert } from './elements'
import { EnemyBoss } from './enemies'
import { getGameState } from './gamestate'
import { get3dSound, destroyComponent, shuffle, randInt, randItem } from './helpers'
import { InteractableElevatorButton, InteractablePowerCore } from './interactables'
import { Pylon } from './pylon'
import { EnemySchematic } from './schematics'

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
    hasFoundElevatorKey: boolean = false
    hasUnlockedElevator: boolean = false

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

        this.setElevator(8, 32, this.floorNumber, this.sectionNumber, this.isTopFloor, this.isBossFloor)

        // Boss rooms
        if (this.isBossFloor) {
            this.copyRect(0, 92, 4, 0, 16, 32)
            this.setElevator(8, 0, 0, this.sectionNumber + 1, true, false)
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
                getGameState().interactibles.push(new InteractableElevatorButton(this.floorIndex, -64, -80, 1, true))
            if (!this.isTopFloor)
                getGameState().interactibles.push(new InteractableElevatorButton(this.floorIndex, 64, -80, -1, true))
            if (this.isBossFloor) {
                getGameState().interactibles.push(new InteractableElevatorButton(this.floorIndex, -64, -1104, 1, false))
                getGameState().pylons.push(new Pylon(this.floorIndex, -16, -268, false))
                getGameState().pylons.push(new Pylon(this.floorIndex, 16, -268, false))
                getGameState().pylons.push(new Pylon(this.floorIndex, -16, -236, false))
                getGameState().pylons.push(new Pylon(this.floorIndex, 16, -236, false))
                getGameState().pylons.push(new Pylon(this.floorIndex, -112, -524, true))
                getGameState().pylons.push(new Pylon(this.floorIndex, 112, -524, true))
                getGameState().pylons.push(new Pylon(this.floorIndex, -112, -748, true))
                getGameState().pylons.push(new Pylon(this.floorIndex, 112, -748, true))
                getGameState().enemies.push(new EnemyBoss(this.floorIndex, 0, -638))

            }
            this.hasSpawnedObjects = true
        }

        if (DEBUG) {
            this.debugGrid = this.scene.add.grid(0, 0, 1024, 1024, 32, 32, undefined, undefined, 0xFF00FF, 0.25)
            this.debugGfx = this.scene.add.graphics({ x: 0, y: 0 })
            this.debugLayer = this.fgLayer.renderDebug(this.debugGfx)
        }

        let debounceTarget: Phaser.GameObjects.GameObject | null = null
        let debounceTime: number = 0

        this.collider = this.scene.physics.add.collider([getGameState().playerGroup, getGameState().droneGroup, getGameState().enemyGroup, getGameState().bulletGroup], this.fgLayer, other => {
            if (!other || !other.body) return

            if (other !== debounceTarget || debounceTime + 500 < Date.now()) {
                getGameState().bumpSound.play(get3dSound(other.body, getGameState().player))
                debounceTarget = other
                debounceTime = Date.now()
            }

            const b = getGameState().bullets.find(b => b.spawned && b.body === other.body)
            if (b) b.destroy()
            const d = getGameState().drones.find(d => d.spawned && d.body === other.body)
            if (d) d.wallCollision()
            const e = getGameState().enemies.find(e => e.spawned && e.body === other.body)
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
            const shouldOpenBossRoom = getGameState().pylons.filter(p => p.floorIndex === this.floorIndex && !p.boss).every(p => p.isPowered)
            if (shouldOpenBossRoom && !this.hasOpenedBossRoom) {
                this.hasOpenedBossRoom = true
                this.setVerticalDoor(11, 23, true)
                this.setVerticalDoor(11, 24, true)
                getGameState().elements.push(new Alert(`The supervisor drone has activated!`))
            }
            const shouldOpenBossElevator = getGameState().enemies.filter(p => p.floorIndex === this.floorIndex && p instanceof EnemyBoss).length === 0
            if (shouldOpenBossElevator && !this.hasOpenedBossElevator) {
                this.hasOpenedBossElevator = true
                this.setVerticalDoor(11, 7, true)
                this.setVerticalDoor(11, 8, true)
                getGameState().elements.push(new Alert(`The supervisor drone was defeated!`))
            }
        }
        if (this.hasSpawnedObjects) {
            const noEnemies = getGameState().enemies.filter(e => e.floorIndex === this.floorIndex && !e.dead).length === 0
            const shouldUnlockElevator = noEnemies || this.hasFoundElevatorKey
            if (shouldUnlockElevator && !this.hasUnlockedElevator) {
                this.hasUnlockedElevator = true
                getGameState().elements.push(new Alert(`Elevator has been unlocked`))
            }
        }
    }

    private spawnRoom(sx: number, sy: number) {
        const tiles = shuffle(this.getEmptyTiles(sx + 1, sy + 1, 8 - 2, 8 - 2))
        const powerCores = randInt(0, 2)
        let enemyBudget = randInt(0, 5 + this.floorIndex) * 5
        while (enemyBudget > 0 && tiles.length) {
            const { x, y } = tiles.pop()!
            const schematic = randItem(EnemySchematic.all.filter(s => s.cost <= enemyBudget))
            if (!schematic) break
            enemyBudget -= schematic.cost
            getGameState().enemies.push(schematic.create(this.floorIndex, x, y, randItem(FACING_4WAY)!, schematic))
        }
        for (let i = 0; i < powerCores && tiles.length; i++) {
            const { x, y } = tiles.pop()!
            getGameState().interactibles.push(new InteractablePowerCore(this.floorIndex, x, y))
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

    private setElevator(dx: number, dy: number, floor: number, section: number, isTopFloor: boolean, isBossFloor: boolean) {
        this.setElevatorFloorIndicators(dx, dy, floor)
        this.setElevatorButtons(dx, dy, isTopFloor, isBossFloor)
        this.setElevatorFloor(dx, dy, section)
    }

    private setElevatorFloorIndicators(dx: number, dy: number, floor: number) {
        this.setTile(dx + 1, dy, 32 * floor + 6)
        this.setTile(dx + 2, dy, 32 * floor + 7)
        this.setTile(dx + 5, dy, 32 * floor + 4)
        this.setTile(dx + 6, dy, 32 * floor + 5)
    }

    private setElevatorButtons(dx: number, dy: number, isTopFloor: boolean, isBossFloor: boolean) {
        this.setTile(dx + 1, dy + 1, null, isBossFloor ? 194 : 192)
        this.setTile(dx + 2, dy + 1, null, isBossFloor ? 195 : 193)
        this.setTile(dx + 5, dy + 1, null, isTopFloor ? 194 : 192)
        this.setTile(dx + 6, dy + 1, null, isTopFloor ? 195 : 193)
    }

    private setElevatorFloor(dx: number, dy: number, section: number) {
        const index = [256, 320, 384, 258, 322][Math.min(section, 4)]

        this.setTile(dx + 3, dy + 3, null, index + 0)
        this.setTile(dx + 4, dy + 3, null, index + 1)
        this.setTile(dx + 3, dy + 4, null, index + 32 + 0)
        this.setTile(dx + 4, dy + 4, null, index + 32 + 1)
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
            this.fgLayer.getTileAt(x, y)?.setCollision(fgIndex !== -1)
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
        return !this.isBossFloor && Math.random() < (0.25 + 0.2 * this.floorNumber) ? randInt(3) : -1
    }
}
