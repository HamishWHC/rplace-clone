import { Mutex } from "async-mutex";

export const COLOUR_PALETTE = [
    "#FFFFFF",
    "#E4E4E4",
    "#888888",
    "#222222",
    "#FFA7D1",
    "#E50000",
    "#E59500",
    "#A06A42",
    "#E5D900",
    "#94E044",
    "#02BE01",
    "#00D3DD",
    "#0083C7",
    "#0000EA",
    "#CF6EE4",
    "#820080"
]

export const PIXEL_SIZE = 10;

export const BOARD_SIZE = { x: 1000, y: 1000 };

export const TIME_BETWEEN_PLACEMENTS = 1 * 1000 // 10*60*1000 // in milliseconds!

export const placingMutex = new Mutex();