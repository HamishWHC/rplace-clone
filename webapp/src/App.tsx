import "csshake/dist/csshake.min.css";
import "firebase/firestore";
import React from 'react';
import { ColorResult } from 'react-color';
import './App.css';
import { Board } from './Board';
import { COLOUR_PALETTE } from './constants';
import { FirebaseContext } from './firebase';
import { Overlay } from './Overlay';
import { IUserData, UserData } from './types';

function App() {
    const [userId, setUserId] = React.useState<string | null>(null)
    const [colour, setColour] = React.useState(COLOUR_PALETTE[5])
    const firebase = React.useContext(FirebaseContext)
    const [userData, setUserData] = React.useState<UserData>("loading")
    const [shake, setShake] = React.useState(false)

    React.useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(user => setUserId(user?.uid ?? null));
        firebase.auth().signInAnonymously()
        return unsubscribe
    }, [firebase])

    React.useEffect(() => {
        if (userId) {
            const unsubscribe = firebase.firestore().collection("users").doc(userId).onSnapshot(snapshot => {
                if (snapshot.exists) setUserData(snapshot.data() as IUserData)
                else setUserData("empty")
            })
            return unsubscribe
        } else {
            setUserData("loading")
        }
    }, [userId, firebase])

    const onColourChange = React.useCallback((colour: ColorResult, _event: React.ChangeEvent<HTMLInputElement>) => {
        setColour(colour.hex)
        console.log(colour)
    }, [])

    return <div className="container">
        <Overlay onColourChange={onColourChange} colour={colour} userData={userData} shake={shake} />
        <Board colour={colour} setShake={setShake} userId={userId} userData={userData} />
    </div>
}

export default App;
