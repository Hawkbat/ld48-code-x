import { EntityBase, UnitBase } from './base'
import { SCREEN_WIDTH, SCREEN_HEIGHT, IconType } from './constants'
import { EnemyBoss } from './enemies'
import { getGameState } from './gamestate'
import { destroyComponent, get3dSound } from './helpers'

export abstract class ElementBase extends EntityBase {

    get isOnCurrentFloor() { return true }

    constructor() {
        super(-1)
    }

    destroy() {
        super.destroy()
        getGameState().elements.splice(getGameState().elements.indexOf(this), 1)
    }
}

export abstract class PowerBarBase extends ElementBase {
    sprites: Phaser.GameObjects.Sprite[] = []

    get isOnCurrentFloor() { return this.target?.isOnCurrentFloor ?? false }

    abstract get spriteKey(): string
    abstract get target(): UnitBase | undefined
    abstract get screenX(): number
    abstract get screenY(): number

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
    get target() { return getGameState().player }

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
    get screenX() { return SCREEN_WIDTH / 2 - (this.target?.maxPower ?? 0) / 10 * 8 - 6 }
    get screenY() { return SCREEN_HEIGHT - 60 }
    get target() { return getGameState().enemies.find(e => e.active && e.isOnCurrentFloor && e instanceof EnemyBoss && (!e.isInvulnerable || e.hurtTime > 0)) }
}

export class SchematicList extends ElementBase {
    text!: Phaser.GameObjects.Text
    boxSprites: Phaser.GameObjects.Sprite[] = []
    iconSprites: Phaser.GameObjects.Sprite[] = []

    get screenX() { return 4 }
    get screenY() { return 44 }

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
        const count = getGameState().player.schematics.length
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

            this.boxSprites[i].setFrame(i === getGameState().player.schematicIndex ? 0 : 1)

            const s = getGameState().player.schematics[i]
            if (s) {
                const deployed = getGameState().drones.some(d => d.schematic === s)
                const canAfford = getGameState().player.power > s.cost
                const row = deployed ? 2 : canAfford ? 0 : 1
                this.iconSprites[i].setFrame(IconType.length * row + s.icon)
            }
            this.iconSprites[i].setVisible(!!s)
        }
        this.text.setText(getGameState().player.schematics[getGameState().player.schematicIndex]?.name ?? '')
    }
}

export class Alert extends ElementBase {
    text!: Phaser.GameObjects.Text
    index: number = 0
    lifetime: number = 5

    get screenX() { return SCREEN_WIDTH }
    get screenY() { return 0 }

    constructor(public msg: string) {
        super()
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)

        for (this.index = 0; this.index < 20; this.index++) {
            if (!getGameState().elements.some(e => e instanceof Alert && e !== this && e.index === this.index)) break
        }
        this.text = this.scene.add.text(this.screenX, this.screenY + this.index * 16, '', { color: 'white', fontSize: '12px', fontFamily: 'sans-serif' })
        this.text.setDepth(9999)
        this.text.setScrollFactor(0, 0)
        this.text.setOrigin(1, 0)
        this.text.setText(this.msg)
    }

    despawn() {
        super.despawn()
        this.text = destroyComponent(this.text)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        if (!this.active) return
        this.lifetime -= dt
        if (this.lifetime < 1) this.text.setAlpha(this.lifetime)
        if (this.lifetime < 0) this.destroy()
    }
}

export class Explosion extends ElementBase {
    sprite!: Phaser.GameObjects.Sprite
    lifetime: number = 7 / 10

    constructor(public x: number, public y: number) {
        super()
    }

    initialize() {
        super.initialize()
        this.scene.anims.create({ key: 'explosion', frames: this.scene.anims.generateFrameNumbers('explosion', {}), frameRate: 10, repeat: 0 })
    }

    spawn(scene: Phaser.Scene) {
        super.spawn(scene)
        this.sprite = this.scene.add.sprite(this.x, this.y, 'explosion')
        this.sprite.setDepth(8000)
        this.sprite.anims.play('explosion')
        getGameState().explosionSound.play(get3dSound(this, getGameState().player))
    }

    despawn() {
        super.despawn()
        this.sprite = destroyComponent(this.sprite)
    }

    update(t: number, dt: number) {
        super.update(t, dt)
        this.lifetime -= dt
        if (this.lifetime <= 0) this.destroy()
    }
}
