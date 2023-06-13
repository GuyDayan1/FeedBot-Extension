import {MINUTE, SECOND} from "./utils/globals";

chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const activeTab = tabs[0];
        if (activeTab.url.includes('web.whatsapp.com')) {
            setTimeout(()=>{
                handleRepeatMessages()
            },5 * SECOND)
        }
    });
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url.includes('web.whatsapp.com')){
        console.log(tab , changeInfo)
    }
});

function handleRepeatMessages(){
        chrome.storage.local.get(["schedulerMessages"], (result) => {
                const schedulerMessages = result.schedulerMessages || [];
                const repeatMessages = schedulerMessages.filter(item=>{
                    return ((!item.messageSent && !item.deleted) && (item.repeatSending || (Date.now()-item.scheduledTime) > MINUTE))
                })
                if (repeatMessages.length > 0){refreshWhatsAppTab()}
        });

}

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


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    let data = request.data;
    if (data.action === 'get-html-file'){
        let htmlFileName = data.fileName;
        getHtmlFile(htmlFileName)
            .then(htmlFile => {sendResponse({ data: htmlFile });})
            .catch(error => {
                sendResponse({ error: 'Failed to fetch HTML file' });
            });
        return true;
    }
    if (data.action === 'update-client-sending-state'){
        client.state = data.state
        client.sendingType = data.sendingType
        console.log(JSON.stringify(client))
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
function refreshWhatsAppTab() {
    chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, function (tabs) {
        if (tabs.length > 0) {
            const tabId = tabs[0].id;
            chrome.tabs.reload(tabId);
        }
    });
}
