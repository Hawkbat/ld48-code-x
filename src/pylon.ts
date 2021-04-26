import { ActorBase } from './base'
import { Alert } from './elements'
import { getGameState } from './gamestate'
import { get3dSound } from './helpers'

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
        if (!this.active || getGameState().player.floorIndex !== this.floorIndex) return
        const dx = Math.abs(getGameState().player.x - this.x)
        const dy = Math.abs(getGameState().player.y - this.y)
        if (dx < 48 && dy < 48) {
            if (!this.isPowered) this.progress += dt * (this.boss ? 1.5 : 2)
            while (this.progress > 1) {
                this.progress--
                this.power = Math.min(this.maxPower, this.power + 1)
                if (this.power === this.maxPower) {
                    getGameState().powerUpSound.play(get3dSound(this, getGameState().player))
                    if (this.boss && getGameState().pylons.filter(p => p.floorIndex === this.floorIndex && p.boss && p.isPowered).length === 1) {
                        getGameState().elements.push(new Alert('Power Surge! Drones have no power cost!'))
                    }
                } else {
                    getGameState().clickSound.play(get3dSound(this, getGameState().player))
                }
            }
        }
    }

    postUpdate() {
        super.postUpdate()
        this.sprite.setFrame(Math.floor(this.power))
    }
}
