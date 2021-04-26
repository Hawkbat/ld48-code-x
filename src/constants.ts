
export const DEBUG = false

export const SCREEN_WIDTH = 640
export const SCREEN_HEIGHT = 360

export type Facing4Way = 'up' | 'right' | 'down' | 'left'
export type Facing8Way = 'center-center' | 'up-left' | 'up-center' | 'up-right' | 'center-right' | 'down-right' | 'down-center' | 'down-left' | 'center-left'

export const FACING_4WAY: Facing4Way[] = ['up', 'right', 'down', 'left']
export const FACING_8WAY: Facing8Way[] = ['up-left', 'up-center', 'up-right', 'center-right', 'down-right', 'down-center', 'down-left', 'center-left']

export enum IconType {
    gun = 0,
    multishot = 1,
    tracking = 2,
    punch = 3,
    boomerang = 4,
    directionalGun = 5,
    directionalMulti = 6,
    directionlTracking = 7,

    length,
}
