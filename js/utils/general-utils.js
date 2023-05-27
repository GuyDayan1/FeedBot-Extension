import * as Globals from "./globals";
import {ISR_PREFIX, ISRAEL_PARAM} from "./globals";

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
    try {
        let chatType;
        let media;
        let chatId;
        const element = document.querySelector("[data-testid*='conv-msg']");
        const dataTestId = element.getAttribute("data-testid");
        const parts = dataTestId.split("_");
        chatId = parts[1];
        if (chatId.includes("@g.us")) {
            media = document.querySelector('span[data-testid="conversation-info-header-chat-title"]').textContent;
            chatType = Globals.GROUP_PARAM
        } else {
            media = chatId.split("@")[0]
            chatType = Globals.CONTACT_PARAM
        }
        return {chatType, media, chatId}
    }catch (error){
        getChatDetails();
    }
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

export function handleFileSelect(event) {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
        const fileType = selectedFile.type;
        if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileType === 'text/csv') {
            // Valid file type, perform further operations
            console.log('File is valid:', selectedFile.name);
            // Add your logic to process the file here
        } else {
            // Invalid file type
            console.log('Invalid file type. Please select a valid XLSX or CSV file.');
            // You can display an error message to the user or perform other actions
        }
    }
}

export function createTable(headers,data) {
    const table = document.createElement('table');
    table.classList.add('fb-table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        th.classList.add('fb-th');
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        if (index % 2 === 0) {
            row.classList.add('fb-tr', 'even-row');
        } else {
            row.classList.add('fb-tr', 'odd-row');
        }
        Object.values(item).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            td.classList.add('fb-td'); // Add the custom cell class
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    return table;
}

export function formatPhoneNumber(phoneNumber, formatType) {
    let newPhone = phoneNumber.trim();
    newPhone = newPhone.replace(/\D/g, ''); // Remove any non-digit characters
    switch (formatType){
        case ISRAEL_PARAM:
            if (newPhone.startsWith('05')){
                newPhone = ISR_PREFIX + newPhone.slice(1)
            }
            if (newPhone.startsWith('5')){
                newPhone = ISR_PREFIX + newPhone;
            }
    }
    console.log(newPhone)
    return newPhone;
}
