import { ActorBase } from './base'
import { Alert } from './elements'
import { getGameState } from './gamestate'
import { get3dSound, destroyComponent } from './helpers'
import { DroneSchematic } from './schematics'

export abstract class DropBase extends ActorBase {
    collider!: Phaser.Physics.Arcade.Collider

    get shadowOffset() { return 4 }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        getGameState().dropGroup.add(this.sprite)
        this.collider = this.scene.physics.add.overlap(this.sprite, getGameState().playerGroup, () => {
            if (this.pickup()) {
                getGameState().powerUpSound.play(get3dSound(this, getGameState().player))
                this.destroy()
            }
        }, undefined, this)
        this.collider.overlapOnly = true
    }

    despawn() {
        super.despawn()
        getGameState().dropGroup.remove(this.sprite)
        this.collider = destroyComponent(this.collider)
    }

    destroy() {
        super.destroy()
        getGameState().drops.splice(getGameState().drops.indexOf(this), 1)
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
        this.scene.anims.create({ key: this.spriteKey, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, {}), frameRate: 5, repeat: -1 })
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.sprite.anims.play(this.spriteKey, true)
    }

    pickup() {
        if (getGameState().player.power < getGameState().player.maxPower) {
            const delta = Math.min(getGameState().player.maxPower - getGameState().player.power, this.power)
            getGameState().player.power += delta
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
        if (getGameState().player.schematics.some(s => s === this.schematic)) return
        /*
        const slotIndex = getGameState().player.schematics.findIndex(s => s === null)
        if (slotIndex === -1) return
        getGameState().player.schematics[slotIndex] = this.schematic
        */
        getGameState().player.schematics.push(this.schematic)
        getGameState().elements.push(new Alert(`Acquired ${this.schematic.name} drone`))
        return true
    }
}

export class DropKey extends DropBase {

    get spriteKey() { return 'pickup-key' }
    get shadowOffset() { return -4 }

    initialize() {
        super.initialize()
        this.scene.anims.create({ key: this.spriteKey, frames: this.scene.anims.generateFrameNumbers(this.spriteKey, {}), frameRate: 5, repeat: -1 })
    }

    postUpdate() {
        super.postUpdate()
        if (!this.active) return
        this.sprite.anims.play(this.spriteKey, true)
    }

    pickup() {
        if (this.floor.hasFoundElevatorKey) return
        getGameState().elements.push(new Alert(`Found an elevator key`))
        this.floor.hasFoundElevatorKey = true
        return true
    }
}
