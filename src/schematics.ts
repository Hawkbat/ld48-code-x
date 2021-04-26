import { IconType, Facing4Way } from './constants'
import { DroneGun, DroneHoverPunch, DroneSpinBoomerang, DroneTracker, DroneDirectionalGun, DroneMultishot, DroneBase } from './drones'
import { EnemyGun, EnemyHoverGun, EnemySpinBoomerang, EnemyDirectionalGun, EnemyHoverPunch, EnemyMultishot, EnemyHoverMultishot, EnemyBoss, EnemyBase } from './enemies'
import { Player } from './player'

export class DroneSchematic {

    static all = [
        new DroneSchematic('Turret', 10, IconType.gun, (p, s) => new DroneGun(p.floorIndex, p.x, p.y, p.facing, s)),
        new DroneSchematic('Puncher', 15, IconType.punch, (p, s) => new DroneHoverPunch(p.floorIndex, p.x, p.y, p.facing, s)),
        new DroneSchematic('Boomerang', 15, IconType.boomerang, (p, s) => new DroneSpinBoomerang(p.floorIndex, p.x, p.y, p.facing, s)),
        new DroneSchematic('Tracker', 15, IconType.tracking, (p, s) => new DroneTracker(p.floorIndex, p.x, p.y, p.facing, s)),
        new DroneSchematic('Strafer', 15, IconType.directionalGun, (p, s) => new DroneDirectionalGun(p.floorIndex, p.x, p.y, p.facing, s)),
        new DroneSchematic('Multishot', 20, IconType.multishot, (p, s) => new DroneMultishot(p.floorIndex, p.x, p.y, p.facing, s)),
    ]

    constructor(public name: string, public cost: number, public icon: IconType, public create: (creator: Player, schematic: DroneSchematic) => DroneBase) {

    }
}

export class EnemySchematic {

    static all = [
        new EnemySchematic('Turret', 10, (f, x, y, facing, s) => new EnemyGun(f, x, y, facing, s)),
        new EnemySchematic('Hover Turret', 15, (f, x, y, facing, s) => new EnemyHoverGun(f, x, y, facing, s)),
        new EnemySchematic('Spin Boomerang', 15, (f, x, y, facing, s) => new EnemySpinBoomerang(f, x, y, facing, s)),
        new EnemySchematic('Directional Turret', 15, (f, x, y, facing, s) => new EnemyDirectionalGun(f, x, y, facing, s)),
        new EnemySchematic('Hover Puncher', 20, (f, x, y, facing, s) => new EnemyHoverPunch(f, x, y, facing, s)),
        new EnemySchematic('Multishot Turret', 20, (f, x, y, facing, s) => new EnemyMultishot(f, x, y, facing, s)),
        new EnemySchematic('Hover Multishot', 25, (f, x, y, facing, s) => new EnemyHoverMultishot(f, x, y, facing, s)),
    ]

    static boss = new EnemySchematic('Boss', Infinity, (f, x, y) => new EnemyBoss(f, x, y))

    constructor(public name: string, public cost: number, public create: (floorIndex: number, x: number, y: number, facing: Facing4Way, schematic: EnemySchematic) => EnemyBase) {

    }
}
