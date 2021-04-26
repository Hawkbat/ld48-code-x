import { ActorBase } from './base'
import { Alert } from './elements'
import { getGameState } from './gamestate'
import { get3dSound } from './helpers'

export abstract class InteractableBase extends ActorBase {

    abstract get actionText(): string

    destroy() {
        super.destroy()
        getGameState().interactibles.splice(getGameState().interactibles.indexOf(this), 1)
    }

    abstract interact(): void
}

export class InteractablePowerCore extends InteractableBase {
    power: number = 20

    get spriteKey() { return 'interactable-power-core' }
    get shadowOffset() { return 4 }
    get actionText() {
        return `Pick up power core (+${this.power} power)`
    }

    interact() {
        if (getGameState().player.power < getGameState().player.maxPower) {
            const delta = Math.min(getGameState().player.maxPower - getGameState().player.power, this.power)
            getGameState().player.power += delta
            getGameState().powerUpSound.play(get3dSound(this, getGameState().player))
            this.destroy()
        } else {
            getGameState().elements.push(new Alert(`Cannot pick up power core (already at max power)`))
        }
    }
}

export class InteractableElevatorButton extends InteractableBase {

    get spriteKey() { return 'interactable-arrows' }
    get shadowOffset() { return 0 }
    get actionText() {
        return `Take elevator ${this.delta === 1 ? 'down' : 'up'}`
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
            getGameState().elevatorSound.play()
            this.scene.cameras.main.fadeOut(250, 0, 0, 0, (cam: Phaser.Cameras.Scene2D.Camera, t: number) => {
                if (t === 1) {
                    for (const d of getGameState().drones) d.destroy()
                    getGameState().player.floorIndex += this.delta
                    getGameState().player.sprite.setPosition(0, 0)
                    this.scene.cameras.main.fadeIn(250, 0, 0, 0, (cam: Phaser.Cameras.Scene2D.Camera, t: number) => {

                    })
                }
            }, this)
        } else if (!this.isValidOnFloor()) {
            getGameState().elements.push(new Alert(`Cannot take elevator ${this.delta === 1 ? 'down' : 'up'}`))
        } else if (!this.isUnlocked()) {
            getGameState().elements.push(new Alert(`Cannot take elevator (locked by enemies)`))
        }
    }

    postUpdate() {
        super.postUpdate()
        this.sprite.anims.play(`elevator-button-${this.delta === 1 ? 'down' : 'up'}`, true)
        this.sprite.setVisible(this.isValidOnFloor() && this.isUnlocked())
    }

    private isUnlocked(): boolean {
        if (this.delta === -1) return true
        return this.floor.hasUnlockedElevator
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
