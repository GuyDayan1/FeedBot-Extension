chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url.includes('web.whatsapp.com')) {
        console.log(new Date() , ": tab id: " ,tabId , "change info " ,changeInfo , "tab " , tab)
    }
});

function getAllTabs() {
    console.log("all tabs:")
    chrome.tabs.query({}, function(tabs) {
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            console.log(tab)
            // Perform actions with each active tab
        }
    });
}


/// check every tab clicked which tab is active
// chrome.tabs.onActivated.addListener((activeInfo) => {
//     const tabId = activeInfo.tabId;
//     chrome.tabs.get(tabId, (tab) => {
//         console.log(tab);
//     });
// });


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get-bulk-sending-modal') {
        getHtmlFile('bulksendmodal')
            .then(htmlFile => {
                sendResponse({ data: htmlFile });
            })
            .catch(error => {
                console.error(error);
                sendResponse({ error: 'Failed to fetch HTML file' });
            });
        return true;
    }
    if (request.action === "refresh"){
        refreshWhatsAppTab();
    }
});

function getHtmlFile(modalName) {
    return new Promise((resolve, reject) => {
        const htmlUrl = chrome.runtime.getURL(`html/${modalName}.html`);
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
    chrome.tabs.query({}, function(tabs) {
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            console.log(tab)
            if (tab.url.includes('whatsapp.com') || tab.title.includes('WhatsApp')) {
                chrome.tabs.reload(tab.id);
                break; // Stop iterating once the WhatsApp tab is found and refreshed
            }
        }
    });
}
