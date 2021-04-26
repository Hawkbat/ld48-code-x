import { Scene } from 'phaser'
import { Facing4Way } from './constants'
import { getGameState } from './gamestate'
import { destroyComponent, get3dSound } from './helpers'


export abstract class EntityBase {
    active: boolean = false
    initialized: boolean = false
    spawned: boolean = false
    scene!: Phaser.Scene

    constructor(public floorIndex: number) {

    }

    get floor() { return getGameState().floors[this.floorIndex] }
    get isOnCurrentFloor() {
        return this.floorIndex === getGameState().player.floorIndex
    }
    get floorNumber() { return this.floorIndex % 5 }
    get sectionNumber() { return Math.floor(this.floorIndex / 5) }

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
                getGameState().damageSound.play(get3dSound(this, getGameState().player))
            }
        }
    }

    die(): void {
        this.dead = true
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
        const tick = Math.floor(t / getGameState().tickRate) * getGameState().tickRate
        if (t / getGameState().tickRate >= tick && t - dt <= tick) {
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
