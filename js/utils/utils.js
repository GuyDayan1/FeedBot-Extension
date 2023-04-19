export function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}


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

export const schedulingTimeAlreadyExist = (schedulerMessages) => {
  const scheduledTimes = schedulerMessages.map(item=> {return item.scheduledTime})
    return containsDuplicates(scheduledTimes);
}

export const simulateKeyPress = (type,keyName) => {    //type = which action to do simulate  , keyName = which key to action
    document.dispatchEvent(new KeyboardEvent(type, {'key': keyName}));
    console.log("try to escape")
}