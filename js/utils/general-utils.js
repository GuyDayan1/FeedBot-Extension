import * as Globals from "./globals";

export async function clearChildesFromParent(parentNode) {
    while (parentNode.firstChild) {
        parentNode.removeChild(parentNode.firstChild)
    }
}

export const areArrayEqual = (arr1, arr2)=>{
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
export const containsDuplicates = (array) => {
    return array.length !== new Set(array).size;
}

export function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export const simulateKeyPress = (type,keyName) => {    //type = which action to do simulate  , keyName = which key to action
    document.dispatchEvent(new KeyboardEvent(type, {'key': keyName}));
    console.log("try to escape")
}

export function listFadeIn(element, duration) {
    let start = performance.now();
    element.style.opacity = "0";
    function update() {
        let now = performance.now();
        let time = Math.min(1, (now - start) / duration);
        element.style.opacity = time;
        if (time < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

export function getDB(dbName) {
    return new Promise((resolve => {
        let db;
        const request = indexedDB.open(dbName);
        request.onerror = (event) => {
            console.error("Why didn't you allow my web app to use IndexedDB?!");
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db)
        };
    }))
}
export function getObjectStoresByKeyFromDB(db , key) {
    return new Promise(((resolve) => {
        let transaction = db.transaction(key, 'readonly')
        let objectStore = transaction.objectStore(key);
        let getAllRequest = objectStore.getAll();
        getAllRequest.onsuccess = ()=>{
            resolve(getAllRequest)
        }
    }))
}

export function getObjectStoreByIndexFromDb(db , key , indexName , query){
    return new Promise((async (resolve) => {
        let transaction = db.transaction(key, 'readonly');
        let objectStore = transaction.objectStore(key);
        let index = objectStore.index(indexName.toString());
        let getAllRequest = index.getAll(query);
        getAllRequest.onsuccess = () => {
            resolve(getAllRequest)
        };
    }))
}
export function getAllObjectStoreByIndexFromDb(db , key , indexName){
    return new Promise((async (resolve) => {
        let transaction = db.transaction(key, 'readonly');
        let objectStore = transaction.objectStore(key);
        let index = objectStore.index(indexName.toString());
        let getAllRequest = index.getAll();
        getAllRequest.onsuccess = () => {
            resolve(getAllRequest)
        };
    }))
}
export function getChatDetails() {
    let type;
    let media;
    let chatId;
    const element = document.querySelector("[data-testid*='conv-msg']");
    const dataTestId = element.getAttribute("data-testid");
    const parts = dataTestId.split("_");
    chatId = parts[1];
    if (chatId.includes("@g.us")) {
        media = document.querySelector('span[data-testid="conversation-info-header-chat-title"]').textContent;
        type = Globals.GROUP_PARAM
    } else {
        media = chatId.split("@")[0]
        type = Globals.CONTACT_PARAM
    }
    return {type, media, chatId}
}

export const addScrollingAbility = (list,maxHeight) => {
    list.style.height = maxHeight
    list.style.overflowY = "scroll"
}


function addModalToDOM(modalContainer) {
    let modalBackdrop = document.createElement('div');
    modalBackdrop.className = "modal-backdrop";
    document.body.appendChild(modalContainer)
    document.body.appendChild(modalBackdrop)

}

function clearModalFromDOM(containerClassName) {
    document.getElementsByClassName(containerClassName)[0].remove()
    document.getElementsByClassName('modal-backdrop')[0].remove()
}