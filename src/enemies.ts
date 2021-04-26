import { BulletPulse } from './bullets'
import { DroneLikeBase } from './base'
import { Facing4Way, FACING_4WAY } from './constants'
import { DropKey, DropSchematic, DropPower } from './drops'
import { getGameState } from './gamestate'
import { destroyComponent, randItem, randInt, randFloat } from './helpers'
import { Explosion } from './elements'
import { EnemySchematic, DroneSchematic } from './schematics'


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
        getGameState().enemyGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, [getGameState().playerGroup, getGameState().droneGroup], (_, other) => {
            const target = getGameState().player.body === other.body ? getGameState().player : getGameState().drones.find(d => d.spawned && d.body === other.body)
            target?.hurt(this.impactDamage, this)
        }, undefined, this)
    }

    despawn() {
        super.despawn()
        getGameState().enemyGroup.remove(this.sprite)
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        getGameState().enemies.splice(getGameState().enemies.indexOf(this), 1)
    }

    die(skipDefaultBehavior?: boolean) {
        super.die()
        getGameState().score.enemiesKilled++
        if (!skipDefaultBehavior) {
            const canDropKey = !this.floor.hasFoundElevatorKey && !this.floor.hasUnlockedElevator && !this.floor.isBossFloor && !getGameState().drops.some(d => d.floorIndex === this.floorIndex && d instanceof DropKey)

            if (canDropKey && Math.random() < 0.1) {
                getGameState().drops.push(new DropKey(this.floorIndex, this.x, this.y))
            } else if (Math.random() < 0.1) {
                const choices = DroneSchematic.all.filter(s => !getGameState().player.schematics.includes(s))
                if (choices.length) getGameState().drops.push(new DropSchematic(this.floorIndex, this.x, this.y, randItem(choices)!))
            } else {
                getGameState().drops.push(new DropPower(this.floorIndex, this.x, this.y, 10))
            }
            getGameState().elements.push(new Explosion(this.x, this.y))
            this.destroy()
        }
    }
}

export class EnemyBoss extends EnemyBase {
    subtick: number = 0

    get movementType() { return 'boss' as const }
    get attachSpriteKey() { return 'transparent' }
    get isInvulnerable() { return this.hurtTime > 0 || !getGameState().pylons.filter(p => p.floorIndex === this.floorIndex && p.boss).every(p => p.isPowered) }

    constructor(floorIndex: number, x: number, y: number) {
        super(floorIndex, x, y, 'down', 100, 10, EnemySchematic.boss)
        this.power = this.maxPower = 100 + this.sectionNumber * 50
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.body.setSize(60, 60)
    }

    tick() {
        super.tick()
        if (!this.active || !this.floor.hasOpenedBossRoom || this.power === 0) return
        if ((this.subtick % 4) === 0) {
            this.body.setVelocity(randInt(1, -1) * 64, randInt(1, -1) * 64)
        } else {
            this.body.setVelocity(0, 0)
        }
        if (this.subtick === 16) {
            const pylonsActive = getGameState().pylons.filter(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered).length
            let enemyBudget = (randInt(1, 1 + pylonsActive) + this.sectionNumber) * 10
            const tiles = this.floor.getEmptyTiles(this.mapX - 1, this.mapY - 1, 3, 3).filter(t => !getGameState().enemies.some(e => e.floorIndex === this.floorIndex && e.mapX === t.tx && e.mapY === t.ty))
            while (enemyBudget > 0 && tiles.length) {
                const { x, y } = tiles.pop()!
                const schematic = randItem(EnemySchematic.all.filter(s => s.cost <= enemyBudget))
                if (!schematic) break
                enemyBudget -= schematic.cost
                getGameState().enemies.push(schematic.create(this.floorIndex, x, y, randItem(FACING_4WAY)!, schematic))
            }
            this.subtick = 0
        } else {
            this.subtick++
        }
    }

    die() {
        super.die(true)
        const explosionSteps = 8
        const explosionDelay = 0.125 * 1000
        for (let i = 0; i < explosionSteps; i++) {
            setTimeout(() => {
                getGameState().elements.push(new Explosion(randFloat(this.x + 24, this.x - 24), randFloat(this.y + 24, this.y - 24)))
            }, i * explosionDelay)
        }
        setTimeout(() => {
            for (const e of getGameState().enemies.filter(e => e.floorIndex === this.floorIndex)) e.power = 0
            getGameState().score.bossesDefeated++
            this.destroy()
            if (getGameState().score.bossesDefeated >= 5) {
                getGameState().score.won = true
                this.scene.scene.start('gameover')
            }
        }, explosionSteps * explosionDelay)
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
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, false, 5))
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

            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx + ox, dy + oy, 256, 2, false, 5))
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 256, 2, false, 5))
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx - ox, dy - oy, 256, 2, false, 5))
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
            let dx = getGameState().player.sprite.x - this.sprite.x
            let dy = getGameState().player.sprite.y - this.sprite.y
            if (Math.abs(dx) > Math.abs(dy))
                this.facing = dx < 0 ? 'left' : 'right'
            else
                this.facing = dy < 0 ? 'up' : 'down'
        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, false, 5))
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
            let dx = getGameState().player.sprite.x - this.sprite.x
            let dy = getGameState().player.sprite.y - this.sprite.y
            if (Math.abs(dx) > Math.abs(dy))
                this.facing = dx < 0 ? 'left' : 'right'
            else
                this.facing = dy < 0 ? 'up' : 'down'
        } else if (this.subtick === 1) {
            const dx = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0
            const dy = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0

            const ox = this.facing === 'up' ? -1 : this.facing === 'down' ? 1 : 0
            const oy = this.facing === 'left' ? -1 : this.facing === 'right' ? 1 : 0

            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx + ox, dy + oy, 256, 2, false, 5))
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 256, 2, false, 5))
            getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx - ox, dy - oy, 256, 2, false, 5))
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
        let dx = getGameState().player.sprite.x - this.sprite.x
        let dy = getGameState().player.sprite.y - this.sprite.y
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
        getGameState().bullets.push(new BulletPulse(this.floorIndex, this.x + dx * 8, this.y + dy * 8, dx, dy, 512, 2, false, 5))
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
