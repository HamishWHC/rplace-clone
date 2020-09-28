import { Mutex } from 'async-mutex';
import "csshake/dist/csshake.min.css";
import firebase, { firestore } from 'firebase/app';
import "firebase/firestore";
import React from 'react';
import { ColorResult, GithubPicker } from 'react-color';
import { MapInteractionCSS } from 'react-map-interaction';
import './App.css';
import { FirebaseContext } from './firebase';
import useWindowDimensions from './window-dimensions';
import githubLogo from "./gh-logo.png"

const Firestore = firebase.firestore

const PIXEL_SIZE = 10;

const BOARD_SIZE = { x: 1000, y: 1000 };

const TIME_BETWEEN_PLACEMENTS = 0.5 * 1000 // 10*60*1000 // in milliseconds!

interface RPlacePixel {
  uid: string,
  colour: string,
  x: number,
  y: number,
  placementTime: Date
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
  lastPlacementTime: firestore.Timestamp | null
}

const getMousePosition = (canvas: HTMLCanvasElement, event: React.MouseEvent<HTMLCanvasElement, MouseEvent>, scale: number) => {
  let rect = canvas.getBoundingClientRect();
  let x = (event.clientX - rect.left) * 1 / scale;
  let y = (event.clientY - rect.top) * 1 / scale;
  return [x, y]
}

const placingMutex = new Mutex();

interface TimeLeft {
  days: number,
  hours: number,
  minutes: number,
  seconds: number
}

const getTimeLeft = (startTime: number): TimeLeft | "can-place" => {
  const timeLeft = (startTime + TIME_BETWEEN_PLACEMENTS) - +new Date();
  if (timeLeft < 0) return "can-place"
  return {
    days: Math.floor(timeLeft / (1000 * 60 * 60 * 24)),
    hours: Math.floor((timeLeft / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((timeLeft / 1000 / 60) % 60),
    seconds: Math.floor((timeLeft / 1000) % 60)
  }
}

function App() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [imageData, setImageData] = React.useState<RPlaceImage | null>(null)
  const [colour, setColour] = React.useState(COLOUR_PALETTE[5])
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const firebase = React.useContext(FirebaseContext)
  const [userData, setUserData] = React.useState<UserData | "empty" | "loading">("loading")
  // "placing" is for the time between when the placingMutex unlocks and the server timestamp gets written to the DB, during which userData.lastPlacementTime is null!
  const [timeLeft, setTimeLeft] = React.useState<TimeLeft | "can-place" | "waiting-for-user-data-load" | "placing">("waiting-for-user-data-load");
  const [shake, setShake] = React.useState(false)
  const { width, height } = useWindowDimensions()
  const [mapInteractionValues, setMapInteractionValues] = React.useState({
    scale: 1,
    translation: {
      x: -BOARD_SIZE.x * PIXEL_SIZE / 2 + width / 2,
      y: -BOARD_SIZE.y * PIXEL_SIZE / 2 + height / 2
    }
  })

  React.useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => setUserId(user?.uid ?? null));
    firebase.auth().signInAnonymously()
    return unsubscribe
  }, [firebase])

  React.useEffect(() => {
    if (userId) {
      const unsubscribe = firebase.firestore().collection("users").doc(userId).onSnapshot(snapshot => {
        if (snapshot.exists) setUserData(snapshot.data() as UserData)
        else setUserData("empty")
      })
      return unsubscribe
    } else {
      setUserData("loading")
    }
  }, [userId, firebase])

  React.useEffect(() => {
    const unsubscribe = firebase.firestore().collection("pixels").onSnapshot((snapshot) => {
      // For each change in the snapshot, add the change to imageData, then change the reference (by passing to Map) to trigger a React state update.
      setImageData(new Map(snapshot.docChanges().reduce(
        (acc, change) => {
          if (change.type === "removed") {
            acc.delete(change.doc.id)
            return acc
          } else {
            return acc.set(change.doc.id, change.doc.data() as RPlacePixel)
          }
        },
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

  React.useEffect(() => {
    if (userData === "loading") setTimeLeft("waiting-for-user-data-load")
    else if (userData === "empty") setTimeLeft("can-place")
    else if (!userData.lastPlacementTime) setTimeLeft("placing")
    else {
      const timer = setInterval(() => setTimeLeft(getTimeLeft(userData.lastPlacementTime!.toMillis())), 1000);
      return () => clearInterval(timer)
    }
  }, [userData]);

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

  const handleColourChangeComplete = React.useCallback((colour: ColorResult, _event: React.ChangeEvent<HTMLInputElement>) => {
    setColour(colour.hex)
    console.log(colour)
  }, [])

  return <div className="container">
    <div className="title-box corner-box">
      <h1 className="box-text">r/Place Clone</h1>
      <h5 className="box-text byline">by <a className="portfolio-link" href="https://hamishwhc.com">HamishWHC</a></h5>
      <a className="gh-logo-link" href="https://github.com/HamishWHC/rplace-clone/">
        <img src={githubLogo} alt="GitHub logo, linking to the r/Place Clone repository." />
      </a>
    </div>
    <div className="colour-picker-box">
      <GithubPicker color={colour} onChangeComplete={handleColourChangeComplete} triangle="hide" colors={COLOUR_PALETTE} />
    </div>
    <div className={`countdown-box corner-box${shake ? " shake-horizontal shake-constant" : ""}`}>
      <h3 className="box-text">{placingMutex.isLocked() || timeLeft === "placing" ? "Placing..." : timeLeft === "waiting-for-user-data-load" ? "Loading..." : timeLeft === "can-place" ? "Place a pixel!" : getCountdownText(timeLeft)}</h3>
    </div>
    <MapInteractionCSS
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
  </div>
}

const getCountdownText = (timeLeft: TimeLeft): string => {
  let text = `${timeLeft.days > 0 ? `${timeLeft.days} day${timeLeft.days !== 1 ? "s" : ""} ` : ""}`
  text += `${timeLeft.hours > 0 ? `${timeLeft.hours} hour${timeLeft.hours !== 1 ? "s" : ""} ` : ""}`
  text += `${timeLeft.minutes > 0 ? `${timeLeft.minutes} minute${timeLeft.minutes !== 1 ? "s" : ""} ` : ""}`
  text += `${`${timeLeft.seconds} second${timeLeft.seconds !== 1 ? "s" : ""} `}`
  text += "until you can place a pixel."
  return text
}

export default App;
