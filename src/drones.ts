import { BulletPulse, BulletTracker } from './bullets'
import { DroneLikeBase } from './base'
import { Facing4Way } from './constants'
import { getGameState } from './gamestate'
import { destroyComponent } from './helpers'
import { DroneSchematic } from './schematics'

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
        getGameState().droneGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, getGameState().enemyGroup, (_, other) => {
            if (!this.dead && this.power > 0) {
                const target = getGameState().enemies.find(e => e.spawned && e.body === other.body)
                target?.hurt(this.impactDamage, this)
            }
        }, undefined, this)
    }

    despawn() {
        super.despawn()
        getGameState().droneGroup.remove(this.sprite)
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        getGameState().drones.splice(getGameState().drones.indexOf(this), 1)
    }

    tick() {
        super.tick()
        if (!getGameState().pylons.some(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered))
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
        getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, true, 5))
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
        let dx = getGameState().player.sprite.x - this.sprite.x
        let dy = getGameState().player.sprite.y - this.sprite.y
        if (Math.abs(dx) > Math.abs(dy))
            this.facing = dx < 0 ? 'left' : 'right'
        else
            this.facing = dy < 0 ? 'up' : 'down'

        dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
        dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
        if (this.subtick === 1) {
            getGameState().bullets.push(new BulletTracker(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, true, 15))
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
        getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, true, 5))
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

export class DroneMultishot extends DroneBase {
    subtick: number = 0
    get movementType() { return 'stationary' as const }
    get attachSpriteKey() { return 'drone-multishot' }

    constructor(floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: DroneSchematic) {
        super(floorIndex, x, y, facing, 5, schematic)
    }

    tick() {
        super.tick()
        if (this.subtick === 0) {

        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0

            const ox = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            const oy = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0

            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx + ox, dy + oy, 256, 2, true, 5))
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 256, 2, true, 5))
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx - ox, dy - oy, 256, 2, true, 5))
        }
        this.subtick = (this.subtick + 1) % 2
    }
}
