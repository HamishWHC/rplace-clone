import firebase from 'firebase/app';
import React from 'react';
import 'firebase/auth';
import 'firebase/firestore';

const config = {
  apiKey: "AIzaSyBqu7VxxWDKZ4FvYP_G0i6fQNbMrrI2y-o",
  authDomain: "rplace-clone.firebaseapp.com",
  databaseURL: "https://rplace-clone.firebaseio.com",
  projectId: "rplace-clone",
  storageBucket: "rplace-clone.appspot.com",
  messagingSenderId: "343386525088",
  appId: "1:343386525088:web:fafeb69a7ce7accf2fa8c5"
};

const fbApp = firebase.initializeApp(config);

const LOCAL_DEV_ENV = false;

if (LOCAL_DEV_ENV) {
  fbApp.firestore().settings({
    host: "localhost:8080",
    ssl: false
  });
}

export default fbApp;

const FirebaseContext = React.createContext<firebase.app.App>(fbApp);

export { FirebaseContext };