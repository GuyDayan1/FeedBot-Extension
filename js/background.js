

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    let currentURL = tab.url;
    let status = tab.status;
    if (currentURL.includes("web.whatsapp") && status === "complete") {
            chrome.tabs.sendMessage(tabId, "complete");
    }
});




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
