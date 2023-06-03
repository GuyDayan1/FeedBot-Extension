



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
                console.error(error);
                sendResponse({ error: 'Failed to fetch HTML file' });
            });
        return true;
    }


    if (request.action === "refresh"){
        refreshWhatsAppTab();
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
