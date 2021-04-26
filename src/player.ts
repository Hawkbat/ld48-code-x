import { UnitBase } from './base'
import { DroneBase } from './drones'
import { Alert } from './elements'
import { getGameState } from './gamestate'
import { get3dSound, dist } from './helpers'
import { InteractableBase } from './interactables'
import { DroneSchematic } from './schematics'

export class Player extends UnitBase {
    placing: boolean = false
    swapping: boolean = false
    schematics: (DroneSchematic | null)[] = [DroneSchematic.all[0]]
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
        getGameState().playerGroup.add(this.sprite)
    }

    despawn() {
        super.despawn()
        getGameState().playerGroup.remove(this.sprite)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active || this.dead) return
        const speed = 128
        let vx = 0
        let vy = 0

        if (getGameState().keys.a.isDown || getGameState().keys.left.isDown) vx -= 1
        if (getGameState().keys.d.isDown || getGameState().keys.right.isDown) vx += 1
        if (getGameState().keys.w.isDown || getGameState().keys.up.isDown) vy -= 1
        if (getGameState().keys.s.isDown || getGameState().keys.down.isDown) vy += 1
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

        if (getGameState().keys.space.isDown && !this.placing) {
            this.placing = true

            const target = this.getTargetForInteract()

            if (target instanceof DroneBase) {
                getGameState().clickSound.play(get3dSound(this, getGameState().player))
                const refund = Math.min(this.maxPower - this.power, target.power)
                this.power += refund
                target.destroy()
            } else if (target instanceof InteractableBase) {
                target.interact()
            } else if (target instanceof DroneSchematic) {
                if (getGameState().drones.some(d => d.schematic === target)) {
                    getGameState().elements.push(new Alert(`Existing ${target.name} must be picked up before redeploying`))
                } else {
                    const noCost = getGameState().pylons.some(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered)
                    if (noCost || this.power > target.cost) {
                        if (!noCost)
                            this.power -= target.cost
                        const drone = target.create(this, target)
                        getGameState().drones.push(drone)
                    } else {
                        getGameState().elements.push(new Alert(`Insufficient power to deploy ${target.name} drone`))
                    }
                }
            }
        }
        if (!getGameState().keys.space.isDown && this.placing) this.placing = false

        if ((getGameState().keys.shift.isDown || getGameState().keys.tab.isDown) && !this.swapping) {
            this.swapping = true
            this.schematicIndex = (this.schematicIndex + 1) % this.schematics.length
        }
        if (!(getGameState().keys.shift.isDown || getGameState().keys.tab.isDown) && this.swapping) this.swapping = false
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.scene.cameras.main.setScroll(Math.round(this.body.x - this.scene.renderer.width / 2), Math.round(this.body.y - this.scene.renderer.height / 2))
    }

    die() {
        super.die()
        getGameState().score.won = false
        this.scene.scene.start('gameover')
    }

    getTargetForInteract() {
        const d = getGameState().drones.filter(d => d.active && d.isOnCurrentFloor && dist(this.sprite, d) < 20).sort((a, b) => dist(this.sprite, a) - dist(this.sprite, b))[0]
        if (d) return d

        const i = getGameState().interactibles.filter(i => i.active && i.isOnCurrentFloor && dist(this.sprite, i) < 20).sort((a, b) => dist(this.sprite, a) - dist(this.sprite, b))[0]
        if (i) return i

        const s = this.schematics[this.schematicIndex]
        if (s) return s
    }

    getContextTargetText() {
        let str = ''
        const target = getGameState().player.getTargetForInteract()
        if (target instanceof DroneBase) {
            str = `Pick up ${target.schematic.name} (+${target.power} power)`
        }
        if (target instanceof InteractableBase) {
            str = target.actionText
        }
        if (target instanceof DroneSchematic) {
            str = `Deploy ${target.name} (-${target.cost} power)`
        }
        return str ? `(Spacebar) ${str}` : ''
    }
}
