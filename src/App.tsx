import React from 'react';
import logo from './logo.svg';
import './App.css';
import { FirebaseContext } from './firebase';

interface RPlacePixel {
  user: string,
  colour: string,
  x: number,
  y: number
}

type RPlaceImage = RPlacePixel[]

function App() {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [imageData, setImageData] = React.useState<RPlaceImage | null>(null)
  const [colour, setColour] = React.useState("#00FF00")
  const firebase = React.useContext(FirebaseContext)
  React.useEffect(() => {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        setUserId(user.uid)
      } else {
        setUserId(null)
      }
    });
    firebase.auth().signInAnonymously()
  }, [firebase])

  React.useEffect(() => {
    firebase.firestore().collection("pixels").onSnapshot((snapshot) => {
      setImageData(snapshot.docs.map(doc => doc.data() as RPlacePixel))
    })
    for (let x = 0; x < 25; x++) {
      for (let y = 0; y < 25; y++) {
        let doc = firebase.firestore().collection("pixels").doc(`${x}-${y}`)
        doc.get().then(snapshot => {
          if (!snapshot.exists) {
            doc.set({
              x, y, colour: "#FFFFFF"
            })
          }
        })
      }
    }
  }, [firebase])

  const pixelAdder = React.useCallback((x, y) => {
    return () => {
      firebase.firestore().collection("pixels").doc(`${x}-${y}`).set({
        x, y,
        colour,
        user: userId
      })
    }
  }, [colour, firebase, userId])

  return (
    <>
      <h1>r/Place Clone</h1>
      {
        imageData && <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(25, 20px)`,
          gridTemplateRows: `repeat(25, 20px)`
        }}>
          {imageData.map(pixel => <div
            key={`${pixel.x}-${pixel.y}`}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: pixel.colour,
              gridColumnStart: pixel.x + 1,
              gridColumnEnd: pixel.x + 2,
              gridRowStart: pixel.y + 1,
              gridRowEnd: pixel.y + 2
            }}
            onClick={pixelAdder(pixel.x, pixel.y)}
          />)}
        </div>
      }
    </>
  );
}

export default App;
