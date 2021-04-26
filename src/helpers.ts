import { SCREEN_WIDTH } from './constants'

export function randInt(max: number, min: number = 0) {
    return min + Math.floor((max + 1 - min) * Math.random())
}

export function randFloat(max: number = 1, min: number = 0) {
    return min + (max + 1 - min) * Math.random()
}

export function randItem<T>(array: T[]): T | null {
    if (array.length === 0) return null
    return array[randInt(array.length - 1)]
}

export function shuffle<T>(array: T[]): T[] {
    const a = [...array]
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(i);
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

export function dist(a: { x: number, y: number }, b: { x: number, y: number }) {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
}

export function get3dSound(entity: { x: number, y: number }, player: { x: number, y: number }) {
    return { pan: Math.min(1, Math.max(-1, (entity.x - player.x) / SCREEN_WIDTH / 2)), volume: 1 - Math.min(1, Math.max(dist(entity, player) / SCREEN_WIDTH / 2)) }
}

export function destroyComponent<T extends { destroy(): void }>(c: T): T {
    c?.destroy()
    return null as any as T
}
