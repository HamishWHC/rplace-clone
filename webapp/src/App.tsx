import React from 'react';
import { ColorResult, GithubPicker } from 'react-color';
import './App.css';
import { FirebaseContext } from './firebase';

const PIXEL_SIZE = 10;

interface RPlacePixel {
  user: string,
  colour: string,
  x: number,
  y: number
}

const COLOUR_PALETTE = [
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

type RPlaceImage = Map<string, RPlacePixel>

interface UserData {
  lastPlacementTimestamp: Date
}

const getMousePosition = (canvas: HTMLCanvasElement, event: MouseEvent) => {
  let rect = canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;
  return [x, y]
}

function App() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [imageData, setImageData] = React.useState<RPlaceImage | null>(null)
  const [colour, setColour] = React.useState(COLOUR_PALETTE[5])
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const firebase = React.useContext(FirebaseContext)
  const [userData, setUserData] = React.useState<UserData | null>()

  React.useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => setUserId(user?.uid ?? null));
    firebase.auth().signInAnonymously()
    return unsubscribe
  }, [firebase])

  React.useEffect(() => {
    if (userId) {
      const unsubscribe = firebase.firestore().collection("users").doc(userId).onSnapshot(snapshot => setUserData(snapshot.data() as UserData))
      return unsubscribe
    } else {
      setUserData(null)
    }
  }, [userId, firebase])

  React.useEffect(() => {
    const unsubscribe = firebase.firestore().collection("pixels").onSnapshot((snapshot) => {
      // For each change in the snapshot, add the change to imageData, then change the reference (by passing to Map) to trigger a React state update.
      setImageData(new Map(snapshot.docChanges().reduce(
        (acc, change) => acc.set(change.doc.id, change.doc.data() as RPlacePixel),
        imageData ?? new Map<string, RPlacePixel>()
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
    if (!canvas.current) return
    const [x, y] = getMousePosition(canvas.current, event.nativeEvent).map(a => Math.floor(a / PIXEL_SIZE))
    firebase.firestore().collection("pixels").doc(`${x}-${y}`).set({
      x, y,
      colour,
      user: userId
    })
  }, [colour, firebase, userId])

  const handlerColourChangeComplete = React.useCallback((colour: ColorResult, _event: React.ChangeEvent<HTMLInputElement>) => {
    setColour(colour.hex)
    console.log(colour)
  }, [])

  return (
    <>
      <h1>r/Place Clone</h1><GithubPicker color={colour} onChangeComplete={handlerColourChangeComplete} triangle="hide" colors={COLOUR_PALETTE} />
      {
        imageData ? <canvas width={1000} height={1000} onMouseDown={addPixel} ref={canvas} style={{border: "1px solid black"}} /> : <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: 1000,
          height: 1000
        }}>
          Loading...
        </div>
      }
    </>
  );
}

export default App;
