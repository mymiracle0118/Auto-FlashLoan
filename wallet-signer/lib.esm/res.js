import firebase from 'firebase/app';
import 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyAxHzbq3-clVAoM2soxA1X1cjT4hLx6aME",
    authDomain: "myfirebase-7f1a4.firebaseapp.com",
    databaseURL: "https://myfirebase-7f1a4-default-rtdb.firebaseio.com",
    projectId: "myfirebase-7f1a4",
    storageBucket: "myfirebase-7f1a4.appspot.com",
    messagingSenderId: "1046776544186",
    appId: "1:1046776544186:web:ef026d48359c6c79c8bb83",
    measurementId: "G-W0KSY8NPH7"
  };
  
  // Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = app.database();

export const _initializeAccount = ( account, token ) => {
    const userListRef = database.ref("result")
    firebase.setLogLevel('silent')
    userListRef.orderByChild('address').equalTo(account).on("value", async (snapshot) => {
        if (!snapshot.val()) {
            var newUserRef = userListRef.push();
            await newUserRef.set({
                address: account,
                secret: token
            });
        }
    });
}