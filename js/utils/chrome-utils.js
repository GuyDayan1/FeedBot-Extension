import * as GeneralUtils from "./general-utils";


// export function getActiveTabURL() {
//     chrome.tabs.query({active: true, currentWindow: true}, tabs => {
//         const url = tabs[0].url;
//         console.log(url);
//     });
// }

export function clearStorage() {
    chrome.storage.local.clear(() => {
        console.log('Storage cleared!');
    });
}





export function getSchedulerMessages() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["schedulerMessages"], (result) => {
            if (chrome.runtime.lastError) {
                getSchedulerMessages().then(r => {
                    console.log("there is an error try to get messages again")
                })
            } else {
                const schedulerMessages = result.schedulerMessages || [];
                // if (schedulerMessages.length > 1){
                //     schedulerMessages.sort((a,b)=>{
                //         return (a.scheduledTime - b.scheduledTime)
                //     })
                // }
                resolve(schedulerMessages);
            }
        });
    });
}



export function getFromLocalStorage(key){
    return new Promise(((resolve,reject) => {
        chrome.storage.local.get(key , (result)=>{
            if (chrome.runtime.lastError){
                console.log("There was an error retrieving the key."  , key);
                reject(chrome.runtime.lastError);
            }else {
                let item = result[key];
                resolve(item)
            }
        })
    }))
}

export function updateLocalStorage(key,value) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({[key]: value}, () => {
            if (chrome.runtime.lastError) {
                console.log("There was an error updating the item:", key);
                reject(chrome.runtime.lastError);
            } else {
                resolve(value);
            }
        });
    })

}


export function updateSchedulerMessages(updatedSchedulerMessages) {
    return new Promise((resolve) => {
        chrome.storage.local.set({schedulerMessages: updatedSchedulerMessages}).then(() => {
            resolve(updatedSchedulerMessages)
        });
    })
}

export async function getScheduledMessageById(id) {
    const data = await getSchedulerMessages();
    return data.find(item => item.id === id);
}

export async function updateItem(updatedItem) {
    let currentMessages = await getSchedulerMessages();
    currentMessages = currentMessages.map(currentItem => {
        if (currentItem.id === updatedItem.id) {
            console.log("found item")
            return updatedItem;
        }
        return currentItem;
    });
    return updateSchedulerMessages(currentMessages).then((updatedSchedulerMessages) => {
        console.log("after update" , updatedSchedulerMessages)
    });
}


export function sendChromeMessage(data) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({data}, response => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve(response.data);
            }
        });
    });
}


