import { BulletBase } from './bullets'
import { DroneBase } from './drones'
import { DropBase } from './drops'
import { ElementBase, PlayerPowerBar, BossPowerBar, SchematicList } from './elements'
import { EnemyBase, EnemyBoss } from './enemies'
import { Floor } from './floor'
import { InteractableBase } from './interactables'
import { Player } from './player'
import { Pylon } from './pylon'

export class GameState {
    player: Player = new Player()
    drones: DroneBase[] = []
    enemies: EnemyBase[] = []
    drops: DropBase[] = []
    bullets: BulletBase[] = []
    interactibles: InteractableBase[] = []
    pylons: Pylon[] = []
    elements: ElementBase[] = [new PlayerPowerBar(), new BossPowerBar(), new SchematicList()]
    floors: Floor[] = []

    tickRate: number = 0.5

    score = {
        enemiesKilled: 0,
        bossesDefeated: 0,
        floorsCleared: 0,
        playTime: 0,
        won: false,
    }

    playerGroup!: Phaser.GameObjects.Group
    droneGroup!: Phaser.GameObjects.Group
    enemyGroup!: Phaser.GameObjects.Group
    dropGroup!: Phaser.GameObjects.Group
    bulletGroup!: Phaser.GameObjects.Group

    normalMusic!: Phaser.Sound.BaseSound
    bossMusic!: Phaser.Sound.BaseSound
    bumpSound!: Phaser.Sound.BaseSound
    damageSound!: Phaser.Sound.BaseSound
    shootSound!: Phaser.Sound.BaseSound
    powerUpSound!: Phaser.Sound.BaseSound
    clickSound!: Phaser.Sound.BaseSound
    elevatorSound!: Phaser.Sound.BaseSound
    explosionSound!: Phaser.Sound.BaseSound

    keys!: {
        w: Phaser.Input.Keyboard.Key,
        a: Phaser.Input.Keyboard.Key,
        s: Phaser.Input.Keyboard.Key,
        d: Phaser.Input.Keyboard.Key,
        left: Phaser.Input.Keyboard.Key,
        right: Phaser.Input.Keyboard.Key,
        up: Phaser.Input.Keyboard.Key,
        down: Phaser.Input.Keyboard.Key,
        space: Phaser.Input.Keyboard.Key,
        shift: Phaser.Input.Keyboard.Key,
        tab: Phaser.Input.Keyboard.Key,
    }

    get floor() { return this.floors[this.player.floorIndex] }

    get entities() { return [this.player, ...this.drones, ...this.enemies, ...this.drops, ...this.bullets, ...this.interactibles, ...this.pylons, ...this.elements, ...this.floors] }

    update(scene: Phaser.Scene, t: number, dt: number) {
        this.score.playTime = t
        this.score.floorsCleared = Math.max(this.score.floorsCleared, this.player.floorIndex)
        while (this.player.floorIndex >= this.floors.length) this.floors.push(new Floor(this.floors.length))
        for (const ent of this.entities.filter(e => e.isOnCurrentFloor && !e.spawned)) ent.spawn(scene)
        for (const ent of this.entities.filter(e => !e.isOnCurrentFloor && e.spawned)) ent.despawn()
        for (const ent of this.entities.filter(e => e.spawned && e.active)) ent.update(t, dt)
        for (const ent of this.entities.filter(e => e.spawned && e.active)) ent.postUpdate()

        const tick = Math.floor(t / this.tickRate) * this.tickRate
        if (t / this.tickRate >= tick && t - dt <= tick) {
            const playBossMusic = this.enemies.some(e => e.isOnCurrentFloor && e.active && e instanceof EnemyBoss) && this.floor.hasOpenedBossRoom
            if (!playBossMusic && !this.normalMusic.isPlaying) this.normalMusic.play()
            if (playBossMusic && !this.bossMusic.isPlaying) this.bossMusic.play()
            if (playBossMusic && this.normalMusic.isPlaying) this.normalMusic.stop()
            if (!playBossMusic && this.bossMusic.isPlaying) this.bossMusic.stop()
        }
    }
}

let gameState: GameState

export function getGameState() {
    return gameState
}

export function resetGameState() {
    gameState = new GameState()
}
