import {GET_FIREBASE_DATA_ACTION, GET_HTML_FILE_ACTION} from "./utils/globals";
import { initializeApp } from "../firebase/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc } from "../firebase/firebase-firestore.js";
import { getFunctions, httpsCallable } from "../firebase/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyD8MubD2sZJ1bjP21B9Az435JpmWnwJeJY",
    authDomain: "feedbot-6f701.firebaseapp.com",
    projectId: "feedbot-6f701",
    storageBucket: "feedbot-6f701.appspot.com",
    messagingSenderId: "529977224760",
    appId: "1:529977224760:web:25e8a373bb178a943a40cd",
    measurementId: "G-QFHDK534YM"
};
const firebase_app = initializeApp(firebaseConfig);
const db = getFirestore(firebase_app);
const functions = getFunctions(firebase_app);


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let data = request.data;
    if (data.action === GET_HTML_FILE_ACTION){
        let htmlFileName = data.fileName;
        getHtmlFile(htmlFileName)
            .then(htmlFile => {sendResponse({ data: htmlFile });})
            .catch(error => {
                sendResponse({ error: 'Failed to fetch HTML file' });
            });
        return true;
    }
    if (data.action === GET_FIREBASE_DATA_ACTION) {
        fetchData()
            .then(data => sendResponse({ data }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Required to use sendResponse asynchronously
    } else
        if (request.action === 'saveData') { //change accordingly
        addData(request.data)
            .then(docRef => sendResponse({ id: docRef.id }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Required to use sendResponse asynchronously
    }else if (request.action === 'sendEmail') { //sample listener action using firebse functions
        const { userEmail, userMessage } = request;
        sendEmail(userEmail, userMessage)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Required to use sendResponse asynchronously
    }
});

function getHtmlFile(htmlFileName) {
    return new Promise((resolve, reject) => {
        const htmlUrl = chrome.runtime.getURL(`html/${htmlFileName}.html`);
        fetch(htmlUrl)
            .then(response => response.text())
            .then(html => {
                resolve(html);
            })
            .catch(error => {
                reject(error);
            });
    });
}









// Add new data to Firestore
const addData = async (data) => {
    try {
        const docRef = await addDoc(collection(db, '[COLLECTION-NAME]'), data);
        return docRef;
    } catch (error) {
        console.error('Error adding data:', error);
        throw error;
    }
};

// Fetch data from Firestore
const fetchData = async () => {
    console.log(db)
    try {
        const q = query(collection(db, "users"));
        console.log(q)
        const querySnapshot = await getDocs(q);
        console.log(querySnapshot)
        const messages = querySnapshot.docs.map(doc => doc.data());
        return { messages };
    } catch (error) {
        console.error('Error getting documents:', error);
        throw error;
    }
};


//sample email function using cloud functions for firebase
async function sendEmail(userEmail, userMessage) {
    // Replace 'your_cloud_function_url' with the actual URL of your deployed cloud function
    const cloudFunctionURL = 'your_cloud_function_url';
    try {
        const response = await fetch(cloudFunctionURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userEmail, userMessage }),
        });
        const result = await response.json();
        console.log('Email sent:', result);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}












// function refreshWhatsAppTab() {
//     chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, function (tabs) {
//         if (tabs.length > 0) {
//             const tabId = tabs[0].id;
//             chrome.tabs.reload(tabId);
//         }
//     });
// }






// function getAllTabs() {
//     console.log("all tabs:")
//     chrome.tabs.query({}, function(tabs) {
//         for (let i = 0; i < tabs.length; i++) {
//             const tab = tabs[i];
//             console.log(tab)
//             // Perform actions with each active tab
//         }
//     });
// }
//
//
// async function getCurrentActiveTab() {
//     let queryOptions = { active: true, lastFocusedWindow: true };
//     let [tab] = await chrome.tabs.query(queryOptions);
//     return tab;
// }
