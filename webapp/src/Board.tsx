import firebase from "firebase";
import React from "react";
import { MapInteractionCSS } from "react-map-interaction";
import { BOARD_SIZE, PIXEL_SIZE, placingMutex, TIME_BETWEEN_PLACEMENTS } from "./constants";
import { FirebaseContext } from "./firebase";
import { IRPlacePixel, RPlaceImage, UserData } from "./types";
import useWindowDimensions from "./window-dimensions";

const Firestore = firebase.firestore

const getMousePosition = (canvas: HTMLCanvasElement, event: React.MouseEvent<HTMLCanvasElement, MouseEvent>, scale: number) => {
    let rect = canvas.getBoundingClientRect();
    let x = (event.clientX - rect.left) * 1 / scale;
    let y = (event.clientY - rect.top) * 1 / scale;
    return [x, y]
}

interface IBoardProps {
    colour: string,
    userId: string | null,
    userData: UserData,
    setShake: React.Dispatch<boolean>
}

export function Board({ colour, userId, userData, setShake }: IBoardProps) {
    const firebase = React.useContext(FirebaseContext)
    const canvas = React.useRef<HTMLCanvasElement>(null)
    const { width, height } = useWindowDimensions()
    const [mapInteractionValues, setMapInteractionValues] = React.useState({
        scale: 1,
        translation: {
            x: -BOARD_SIZE.x * PIXEL_SIZE / 2 + width / 2,
            y: -BOARD_SIZE.y * PIXEL_SIZE / 2 + height / 2
        }
    })
    const [imageData, setImageData] = React.useState<RPlaceImage | null>(null)

    React.useEffect(() => {
        const unsubscribe = firebase.firestore().collection("pixels").onSnapshot((snapshot) => {
            // For each change in the snapshot, add the change to imageData, then change the reference (by passing to Map) to trigger a React state update.
            setImageData(new Map(snapshot.docChanges().reduce(
                (acc, change) => {
                    if (change.type === "removed") {
                        acc.delete(change.doc.id)
                        return acc
                    } else {
                        return acc.set(change.doc.id, change.doc.data() as IRPlacePixel)
                    }
                },
                imageData ?? new Map<string, IRPlacePixel>()
            )))
        })
        return unsubscribe
        // imageData should not be included here as we do not want the effect run (which would duplicate the snapshot handler) whenever the image updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firebase])

    React.useEffect(() => {
        if (!canvas.current || !imageData) return
        const ctx = canvas.current?.getContext("2d")
        if (!ctx) return
        imageData.forEach(pixel => {
            ctx.fillStyle = pixel.colour
            ctx.fillRect(pixel.x * PIXEL_SIZE, pixel.y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
        })
    }, [imageData])

    const addPixel = React.useCallback((event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
        if (!canvas.current || !userId || userData === "loading" || placingMutex.isLocked()) return
        console.log(userData)
        if (userData !== "empty") {
            // For an unknown reason, userData.lastPlacementTime can be null (I think its during the update to be a server timestamp on firebase's end), so we check for that,
            // to prevent a placement attempt if that is the case.s
            if (!userData.lastPlacementTime || (userData.lastPlacementTime && new Date().getTime() - TIME_BETWEEN_PLACEMENTS <= userData.lastPlacementTime.toMillis())) {
                setShake(true)
                setTimeout(() => setShake(false), 250)
                return
            }
        }

        event.persist()
        placingMutex.acquire().then(release => {
            if (!canvas.current) {
                release()
                return
            }
            const [x, y] = getMousePosition(canvas.current, event, mapInteractionValues.scale).map(a => Math.floor(a / PIXEL_SIZE))
            const batch = firebase.firestore().batch()
            batch.set(firebase.firestore().collection("pixels").doc(`${x}-${y}`), {
                x, y,
                colour,
                uid: userId,
                placementTime: Firestore.FieldValue.serverTimestamp()
            })
            batch.set(firebase.firestore().collection("users").doc(userId), {
                lastPlacementTime: Firestore.FieldValue.serverTimestamp()
            })
            batch.commit().then(release).catch(err => { console.error(err); release() })
        })
    }, [colour, firebase, userId, userData, mapInteractionValues.scale])

    return <MapInteractionCSS
        showControls={true}
        translationBounds={{
            xMin: width / 2 - BOARD_SIZE.x * PIXEL_SIZE * mapInteractionValues.scale,
            xMax: width / 2,
            yMin: height / 2 - BOARD_SIZE.y * PIXEL_SIZE * mapInteractionValues.scale,
            yMax: height / 2
        }}
        disablePan={placingMutex.isLocked() || !imageData}
        disableZoom={placingMutex.isLocked() || !imageData}
        value={mapInteractionValues}
        onChange={setMapInteractionValues}
        controlsClass="controls-box corner-box"
        btnClass="controls-button"
        plusBtnClass="controls-plus-button"
        minusBtnClass="controls-minus-button"
        plusBtnContents={<></>}
        minusBtnContents={<></>}
    >
        <canvas width={BOARD_SIZE.x * PIXEL_SIZE} height={BOARD_SIZE.y * PIXEL_SIZE} onDoubleClick={addPixel} ref={canvas} className="board" />
    </MapInteractionCSS>
}