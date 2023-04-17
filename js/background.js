chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    let currentURL = tab.url
    let status = tab.status
    if (currentURL.includes("web.whatsapp") && status === "complete") {
        chrome.tabs.sendMessage(tabId, "complete");
    }
});
