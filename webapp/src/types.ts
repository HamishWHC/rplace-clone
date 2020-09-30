import {firestore} from "firebase"

export interface IRPlacePixel {
    uid: string,
    colour: string,
    x: number,
    y: number,
    placementTime: Date
}

export type RPlaceImage = Map<string, IRPlacePixel>

export interface IUserData {
    lastPlacementTime: firestore.Timestamp | null
}

export type UserData = IUserData | "empty" | "loading"

export interface IMapInteractionValues {
    translation: {x: number, y: number},
    scale: number
}

export interface ITimeLeft {
    days: number,
    hours: number,
    minutes: number,
    seconds: number
}