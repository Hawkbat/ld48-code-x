import { ActorBase } from './base'
import { Facing8Way } from './constants'
import { DroneBase } from './drones'
import { EnemyBase } from './enemies'
import { getGameState } from './gamestate'
import { get3dSound, destroyComponent } from './helpers'
import { Player } from './player'

export abstract class BulletBase extends ActorBase {
    collider!: Phaser.Physics.Arcade.Collider

    get shadowOffset() { return 4 }

    constructor(floorIndex: number, x: number, y: number, public dx: number, public dy: number, public speed: number, public lifetime: number, public friendly: boolean) {
        super(floorIndex, x, y)
    }

    initialize() {
        super.initialize()

        getGameState().shootSound.play(get3dSound(this, getGameState().player))

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
        getGameState().bulletGroup.add(this.sprite)
        this.body.setSize(8, 8)
        this.collider = this.scene.physics.add.overlap(this.sprite, [getGameState().playerGroup, getGameState().droneGroup, getGameState().enemyGroup], (_, other) => {
            const target = getGameState().player.body === other.body ? getGameState().player : (getGameState().drones.find(d => d.spawned && d.body === other.body) ?? getGameState().enemies.find(e => e.spawned && e.body === other.body))
            if (target && this.hit(target)) this.destroy()
        }, undefined, this)
        this.collider.overlapOnly = true
    }

    despawn() {
        super.despawn()
        getGameState().bulletGroup.remove(this.sprite)
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        getGameState().bullets.splice(getGameState().bullets.indexOf(this), 1)
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
            const dir = new Phaser.Math.Vector2(getGameState().player.sprite.x - this.sprite.x, getGameState().player.sprite.y - this.sprite.y).normalize()
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
