import * as GeneralUtils from "./general-utils";


export function getActiveTabURL() {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        const url = tabs[0].url;
        console.log(url);
    });
}

export function clearStorage() {
    chrome.storage.local.clear(() => {
        console.log('Storage cleared!');
    });
}


export function getSchedulerMessages() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["schedulerMessages"], (result) => {
            if (chrome.runtime.lastError) {
                reject([]);
            } else {
                const schedulerMessages = result.schedulerMessages || [];
                if (schedulerMessages.length > 1){
                    schedulerMessages.sort((a,b)=>{
                        return (a.scheduledTime - b.scheduledTime)
                    })
                }
                resolve(schedulerMessages);
            }
        });
    });
}

export function updateSchedulerMessages(updatedSchedulerMessages) {
    return new Promise((resolve) => {
        chrome.storage.local.set({schedulerMessages: updatedSchedulerMessages}).then(() => {
            resolve(updatedSchedulerMessages)
        });
    })
}

export async function getScheduleMessageById(id) {
    const data = await getSchedulerMessages();
    return data.find(item => item.id === id);
}

export async function updateItem(updatedItem) {
    let currentMessages = await getSchedulerMessages();
    currentMessages = currentMessages.map(currentItem => {
        if (currentItem.id === updatedItem.id) {
            return updatedItem;
        }
        return currentItem;
    });
    return updateSchedulerMessages(currentMessages).then((updatedSchedulerMessages) => {
        console.log(updatedSchedulerMessages)
    });
}



export const schedulingTimeAlreadyExist = (schedulerMessages) => {
    const scheduledTimes = schedulerMessages.map(item=> {return item.scheduledTime})
    return GeneralUtils.containsDuplicates(scheduledTimes);
}

function getHtmlFile(modalName) {
    let containerName = "fb-modal-container";
    return new Promise((async resolve => {
        let htmlUrl = chrome.runtime.getURL(`html/${modalName}.html`);
        await fetch(htmlUrl)
            .then((response) => {
                return response.text();
            })
            .then((html) => {
                let modalContainer = document.createElement("div");
                modalContainer.className = containerName.toString();
                modalContainer.innerHTML = html;
                resolve(modalContainer)
            });
    }))
}