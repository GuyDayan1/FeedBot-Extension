import * as ChromeUtils from "./utils/chrome-utils";
import * as GeneralUtils from "./utils/general-utils"
import * as Globals from "./utils/globals"
import * as WhatsAppGlobals from './utils/whatsappglobals'
import * as SwalUtils from './utils/swal-utils'
import * as ExcelUtils from "./utils/excel-utils";
import Swal from "sweetalert2";
import {getScheduleMessageById} from "./utils/chrome-utils";


let headerElement;
let cellFrameElement;
let connected = false;
let schedulerMessagesDisplay = false;
let completeStatusCounter = 0;
let currentChatDetails = {type: "", media: "", chatId: ""}
let feedBotIcon;
let load = false;
let emptyMessagesAlert;
let modalBackdrop;
let clockIcon;
let client = {state: Globals.UNUSED_STATE, sendingType: "", language: "he"};
let chatInputPlaceholder = '';
let activeMessagesTimeout = {};
let translation = {}
let whatsAppSvgElement;
let feedBotListOptions = [];
let excelFeaturesListOptions = []


chrome.runtime.onMessage.addListener((message, sender, response) => {
    if (message === "complete") {
        completeStatusCounter++;
        if ((completeStatusCounter > 1) && (!load)) {
            initTranslations().then(() => {
                console.log("Finish to load translations")
                console.log(translation)
                loadExtension().then(() => console.log("Finish to load extension"))
            })
            load = true;
        }
    }

});


const loadExtension = async () => {
    await addFeedBotIcon();
    await initMessagesTimeOut();
    await chatListener();
};


async function initTranslations() {
    client.language = localStorage.getItem(WhatsAppGlobals.WA_language).replaceAll('"', '').split("_")[0] || Globals.HEBREW_LANGUAGE_PARAM;
    let languagePath = `languages/${client.language}.json`;
    let htmlUrl = chrome.runtime.getURL(languagePath);
    const response = await fetch(htmlUrl);
    translation = await response.json();
}

function addFeedBotIcon() {
    const headerElementObserver = new MutationObserver(async () => {
        headerElement = document.querySelector(WhatsAppGlobals.chatListHeaderElement);
        if (headerElement !== null) {
            connected = true;
            headerElementObserver.disconnect();
            await getSvgWhatsAppElement();
            let secondDiv = headerElement.childNodes[1];
            let childNodes = secondDiv.childNodes;
            const firstChild = childNodes[0].firstChild;
            const feedBotDivExists = document.getElementsByClassName("feedBot-icon")[0]
            if (!feedBotDivExists) {
                feedBotIcon = document.createElement("div");
                feedBotIcon.style.backgroundImage = `url(${chrome.runtime.getURL("images/feedBot-icon.png")})`;
                feedBotIcon.className = "feedBot-icon";
                feedBotIcon.title = "FeedBot";
                childNodes[0].insertBefore(feedBotIcon, firstChild);
                feedBotIcon.addEventListener('click', () => {
                    const feedBotFeaturesList = document.getElementsByClassName("fb-features-dropdown")[0]
                    if (!feedBotFeaturesList) {
                        addFeedBotFeatures()
                    } else {
                        removeFeedBotFeatures()
                    }
                })
                window.addEventListener("click", (event) => {
                    const feedBotFeaturesList = document.getElementsByClassName("fb-features-dropdown")[0]
                    if ((!feedBotIcon.contains(event.target)) && (feedBotFeaturesList)) {
                        removeFeedBotFeatures()
                    }
                });
            }
            cellFrameElement = document.querySelector(WhatsAppGlobals.cellFrameElement);

            if (client.language.includes(Globals.HEBREW_LANGUAGE_PARAM)) {
                chatInputPlaceholder = translation.typeMessage
            }
            if (client.language.includes(Globals.ENGLISH_LANGUAGE_PARAM)) {
                chatInputPlaceholder = translation.typeMessage
            }

            feedBotListOptions.push(translation.scheduledMessages, translation.exportToExcel)
            excelFeaturesListOptions.push(translation.allWhatsAppContacts, translation.participantsFromAllGroups, translation.participantsFromSelectedGroups)
            //ChromeUtils.clearStorage()
        }

    });
    headerElementObserver.observe(document.body, {childList: true, subtree: true});
}


function getHtmlFile() {
    return new Promise((async resolve => {
        let htmlUrl = chrome.runtime.getURL("html/schedulerModal.html");
        await fetch(htmlUrl)
            .then((response) => {
                return response.text();
            })
            .then((html) => {
                let modalContainer = document.createElement("div");
                modalContainer.className = "scheduler-modal-container";
                modalContainer.innerHTML = html;
                resolve(modalContainer)
            });
    }))
}

async function openSchedulerModal(data) {
    let modalContainer = await getHtmlFile();
    let dateInputSchedulerModal = modalContainer.querySelector('#datepicker')
    let closeSchedulerModal = modalContainer.querySelector("#close-modal");
    let cancelSchedulerModalButton = modalContainer.querySelector("#cancel-modal-button");
    let hourSelectorSchedulerModal = modalContainer.querySelector("#hour");
    let minuteSelectorSchedulerModal = modalContainer.querySelector("#minute");
    let sendButtonSchedulerModal = modalContainer.querySelector("#send-button");
    let messageSchedulerModal = modalContainer.querySelector('#message')
    addSelectOptions(hourSelectorSchedulerModal, "hour")
    addSelectOptions(minuteSelectorSchedulerModal, "minute")
    closeSchedulerModal.addEventListener('click', () => {clearSchedulerModal();})
    cancelSchedulerModalButton.addEventListener('click', () => {clearSchedulerModal()})
    if (data.type === Globals.NEW_MESSAGE) {
        let currentDate = new Date();
        dateInputSchedulerModal.value = currentDate.toISOString().slice(0, 10);
        hourSelectorSchedulerModal.selectedIndex = currentDate.getHours();
        minuteSelectorSchedulerModal.selectedIndex = currentDate.getMinutes()
        let textInput = document.querySelectorAll('[class*="text-input"]')[1];
        if (textInput.textContent !== chatInputPlaceholder) {
            messageSchedulerModal.value = textInput.textContent
        }
    }
    if (data.type === Globals.EDIT_MESSAGE){
        const item = await getScheduleMessageById(data.itemId)
        dateInputSchedulerModal.value = item.scheduledTime.toISOString().slice(0, 10);
        hourSelectorSchedulerModal.selectedIndex = item.scheduledTime.getHours();
        minuteSelectorSchedulerModal.selectedIndex = item.scheduledTime.getMinutes()
        messageSchedulerModal.value = item.message;
    }
    sendButtonSchedulerModal.addEventListener("click", async () => {
        await handleSendButtonClick(data)
    });

    let modalContainerExist = document.getElementsByClassName('scheduler-modal-container')[0];
    if (!modalContainerExist) {
        addModalToDOM(modalContainer);
    }
}

function addModalToDOM(modal) {
    modalBackdrop = document.createElement('div');
    modalBackdrop.className = "modal-backdrop";
    document.body.appendChild(modal)
    document.body.appendChild(modalBackdrop)
}

function clearSchedulerModal() {
    document.getElementsByClassName('scheduler-modal-container')[0].remove()
    document.getElementsByClassName('modal-backdrop')[0].remove()
}

async function initMessagesTimeOut() {
    waitForNode(document.body, WhatsAppGlobals.paneSideElement).then(async () => {
        if (Object.keys(activeMessagesTimeout.length === 0)) {
            await clearAllItemsTimeOuts();
        }
        let schedulerMessages = await ChromeUtils.getSchedulerMessages();
        const now = Date.now();
        const relevantMessages = [];
        const unSentMessages = [];
        for (let i = 0; i < schedulerMessages.length; i++) {
            const item = schedulerMessages[i];
            if (!item.messageSent && !item.deleted) {
                if (item.scheduledTime < now) {
                    unSentMessages.push(item);
                } else {
                    relevantMessages.push(item);
                }
            }
        }
        for (let i = 0; i < relevantMessages.length; i++) {
            let currentMessage = relevantMessages[i];
            console.log("set time out to message number: " + currentMessage.id)
            const elapsedTime = currentMessage.scheduledTime - Date.now();
            await setTimeOutForMessage(currentMessage.id, currentMessage.chatTitleElement.chatName, elapsedTime, currentMessage.notifyBeforeSending);
        }
        if (unSentMessages.length > 0) {
            showSentMessagesPopup(unSentMessages)
        }
    })
}


function chatListener() {
    waitForNode(document.body, WhatsAppGlobals.paneSideElement).then(r => {
        document.body.addEventListener('click', () => {
            waitForNodeWithTimeOut(document.body, WhatsAppGlobals.conversationHeaderElement, 3000).then(async (element) => {
                currentChatDetails = GeneralUtils.getChatDetails();
                waitForNodeWithTimeOut(document.body, WhatsAppGlobals.composeBoxElement, 3000)
                    .then((element) => {
                        const clockIcon = document.getElementById("clock-icon");
                        if (!clockIcon) {
                            console.log("add clock")
                            addSchedulerButton()
                        }
                    })
                    .catch((error) => {
                        console.log(error)
                    });

            })
        })
    })
}


async function clearAllItemsTimeOuts() {
    for (let id in activeMessagesTimeout) {
        clearTimeout(activeMessagesTimeout[id]);
        console.log("cleared,  id: " + id + " timeoutId " + activeMessagesTimeout[id])
    }
}

function clearTimeOutItem(id) {
    clearTimeout(activeMessagesTimeout[id])
    delete activeMessagesTimeout[id]
    console.log("active messages timeouts:")
    console.log(activeMessagesTimeout)

}


async function getSvgWhatsAppElement() {
    whatsAppSvgElement = document.querySelector(WhatsAppGlobals.menuElement)
    whatsAppSvgElement.removeEventListener('click', () => {
    })
}

async function removeFeedBotFeatures() {
    const feedBotListFeatures = document.getElementsByClassName("fb-features-dropdown")[0];
    feedBotIcon.removeChild(feedBotListFeatures)
}

async function addFeedBotFeatures() {
    console.log("Here")
    const feedBotListFeatures = document.createElement("ul");
    feedBotListFeatures.className = "fb-features-dropdown";
    for (let i = 0; i < feedBotListOptions.length; i++) {
        const feedBotListItem = document.createElement("li");
        feedBotListItem.className = "fb-list-item"
        const textSpan = document.createElement("span");
        textSpan.textContent = feedBotListOptions[i];
        feedBotListItem.appendChild(textSpan)
        feedBotListFeatures.appendChild(feedBotListItem);
        switch (feedBotListOptions[i]) {
            case translation.scheduledMessages:
                feedBotListItem.addEventListener("click", ()=>{
                        showScheduledMessages()
                })
                break;
            case translation.exportToExcel:
                const excelSubListFeatures = document.createElement("ul");
                excelSubListFeatures.className = "fb-excel-features-dropdown";
                const arrowSvgData = {
                    data_testid: "arrow",
                    data_icon: "arrow",
                    height: 20,
                    width: 20,
                    d: Globals.LEFT_ARROW_SVG_PATH_VALUE
                }
                const arrowElement = createSvgElement(arrowSvgData);
                arrowElement.style.marginRight = "auto"
                feedBotListItem.childNodes[0].style.display = "flex"
                feedBotListItem.childNodes[0].appendChild(arrowElement)
                feedBotListItem.appendChild(excelSubListFeatures)
                for (let i = 0; i < excelFeaturesListOptions.length; i++) {
                    const excelListItem = document.createElement("li");
                    excelListItem.className = "fb-list-item";
                    const textSpan = document.createElement("span");
                    textSpan.textContent = excelFeaturesListOptions[i];
                    excelListItem.appendChild(textSpan)
                    excelSubListFeatures.appendChild(excelListItem);
                    switch (excelFeaturesListOptions[i]) {
                        case translation.participantsFromAllGroups:
                            excelListItem.addEventListener("click", getAllGroupsParticipants)
                            break;
                        case translation.participantsFromSelectedGroups:
                            excelListItem.addEventListener("click", getSelectedGroupsParticipants)
                            break;
                        case translation.allWhatsAppContacts:
                            excelListItem.addEventListener("click", getAllWhatsAppContacts)
                            break;
                    }
                }
                break;
        }
    }
    feedBotIcon.appendChild(feedBotListFeatures);
    GeneralUtils.listFadeIn(feedBotListFeatures, 300)
}


function createSvgElement(data) {
    let element = whatsAppSvgElement.cloneNode(true)
    element.setAttribute('data-testid', data.data_testid);
    element.setAttribute('data-icon', data.data_icon);
    element.childNodes[0].setAttribute('height', data.height)
    element.childNodes[0].setAttribute('width', data.width)
    element.childNodes[0].childNodes[0].setAttribute('d', data.d)
    return element;
}

const enterGroupChatByName = async (groupName) => {


}

async function getSelectedGroupsParticipants() {
    const modelStorageDB = await GeneralUtils.getDB("model-storage")


}

async function getAllWhatsAppContacts() {

    const modelStorageDB = await GeneralUtils.getDB("model-storage")
    //not saved on my phone
    await GeneralUtils.getObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact', 0).then((response) => {
        const result = response.result;
        const unSavedContacts = result.map(item => {
            const phoneNumber = item.id.split('@')[0];
            const pushName = item.pushname || ''
            return {phone: phoneNumber, name: pushName};
        })
        const headers = [translation.phoneNumber, translation.contactName]
        ExcelUtils.exportToExcel(unSavedContacts, translation.unSavedContacts, headers)
    })
    //saved on my phone
    await GeneralUtils.getObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact', 1).then((response) => {
        const result = response.result;
        const savedContacts = result.map(item => {
            const phoneNumber = item.id.split('@')[0];
            const phoneBookContactName = item.name || '';
            const whatsappUserName = item.pushname || '';
            return {phoneNumber, phoneBookContactName, whatsappUserName}
        })
        const headers = [translation.phoneNumber, translation.contactName, translation.whatsappUsername]
        ExcelUtils.exportToExcel(savedContacts, translation.savedContacts, headers)

    })
    // all
    await GeneralUtils.getAllObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact').then((response) => {
        const result = response.result;
    })
}

async function getAllGroupsParticipants() {
    let phones;
    const modelStorageDB = await GeneralUtils.getDB("model-storage")
    await GeneralUtils.getObjectStoresByKeyFromDB(modelStorageDB, 'participant').then((response) => {
        const groupParticipants = response.result;
        const participants = groupParticipants.map(item => {
            if (item.participants.length > 0 || true) {
                return item.participants;
            }
        }).flat();
        const uniqueParticipants = [...new Set(participants)]
        phones = uniqueParticipants.map(chatId => {
            return chatId.split('@')[0]
        })

        const phonesObjects = phones.map(phone => ({phone})); // must convert to object like phone:"972546432705"
        ExcelUtils.exportToExcel(phonesObjects, translation.phonesFromAllGroups)
    })
    // const IDBRequest1 = await getObjectStoresByKeyFromDB(modelStorageDB , 'group-metadata').then((response)=>{
    //     console.log(response)
    // })
    // const IDBRequest2 = await getObjectStoresByKeyFromDB(modelStorageDB , 'contact').then((response)=>{
    //     console.log(response)
    // })
}


async function showScheduledMessages() {
    let schedulerMessagesExist = document.getElementsByClassName('scheduler-messages-container')[0]
    if (!schedulerMessagesExist){
        const paneSideElement = document.querySelector(WhatsAppGlobals.paneSideElement)
        const schedulerListContainer = document.createElement("div");
        schedulerListContainer.className = "scheduler-messages-container";
        const backToChatList = document.createElement('div')
        backToChatList.className = "back-to-chat-list";
        backToChatList.innerText = translation.backToChat
        const messagesList = document.createElement("div");
        messagesList.className = "messages-list";
        GeneralUtils.addScrollingAbility(messagesList)
        backToChatList.addEventListener('click', () => {
            schedulerListContainer.remove()
            paneSideElement.style.display = "flex";
        })
        schedulerListContainer.appendChild(backToChatList)
        schedulerListContainer.appendChild(messagesList);
        paneSideElement.insertAdjacentElement('afterend', schedulerListContainer)
        paneSideElement.style.display = "none"
        // waitForNode(document.body, WhatsAppGlobals.paneSideElement).then((element) => {
        //     element.insertAdjacentElement('afterend', schedulerListContainer)
        // })
        // await GeneralUtils.clearChildesFromParent(messagesList)
        const schedulerMessages = await ChromeUtils.getSchedulerMessages();
        const relevantMessages = schedulerMessages.filter(item => (!item.messageSent) && (!item.deleted))
        if (relevantMessages.length > 0) {
            for (const item of relevantMessages) {
                const messageFrame = await createMessageFrame(item);
                messagesList.appendChild(messageFrame);
            }
            async function createMessageFrame(item) {
                const newCellFrame = cellFrameElement.cloneNode(true)
                const clickListener = (event) => {};
                newCellFrame.addEventListener('click', clickListener);
                newCellFrame.removeEventListener('click', clickListener);
                //frameStyle
                newCellFrame.style.paddingBottom = "5px"
                newCellFrame.style.paddingTop = "2px"
                // ** contact name ** //
                const cellFrameTitleElement = newCellFrame.querySelector('div[data-testid="cell-frame-title"]');
                const firstCellFrameChild = cellFrameTitleElement.childNodes[0];
                const chatTextElement = firstCellFrameChild.childNodes[0]
                const chatTitleItem = item.chatTitleElement;
                await GeneralUtils.clearChildesFromParent(firstCellFrameChild)
                chatTextElement.title = chatTitleItem.chatName;
                chatTextElement.textContent = chatTitleItem.chatName;
                firstCellFrameChild.appendChild(chatTextElement)
                let emoji
                const emojiAttr = chatTitleItem.emojiAttr
                if (emojiAttr) {
                    emoji = document.createElement('img')
                    emoji.src = emojiAttr.src
                    emoji.alt = emojiAttr.alt;
                    emoji.className = emojiAttr.className
                    emoji.style.backgroundPosition = emojiAttr.backgroundPosition;
                    emoji.draggable = false;
                    chatTextElement.appendChild(emoji)
                }
                // ** message date ** //
                const detailContainer = newCellFrame.querySelector('div[data-testid="cell-frame-primary-detail"]')
                detailContainer.childNodes[0].textContent = item.dateTimeStr;
                detailContainer.style.color = "#667781"
                //contact - text
                const lastMessageStatus = newCellFrame.querySelector('span[data-testid="last-msg-status"]');
                lastMessageStatus.title = item.message
                lastMessageStatus.style.color = "#7e7a7a"
                lastMessageStatus.style.fontWeight = "bold"
                await GeneralUtils.clearChildesFromParent(lastMessageStatus)
                // const chatNameTitle = firstCellFrameChild.childNodes[0];
                let messageTextElement = chatTextElement.cloneNode(true)
                messageTextElement.textContent = item.message
                messageTextElement.title = item.message
                lastMessageStatus.appendChild(messageTextElement)
                // add cancel button
                const cellFrameSecondary = newCellFrame.querySelector('div[data-testid="cell-frame-secondary"]');
                const iconPlaceElement = cellFrameSecondary.childNodes[1];
                if (iconPlaceElement) {
                    const currentFirstChild = iconPlaceElement.children[0];
                    iconPlaceElement.removeChild(currentFirstChild);
                    // add cancel button
                    const deleteMessageButton = document.createElement('button')
                    deleteMessageButton.textContent = "מחק"
                    deleteMessageButton.className = "custom-cancel-button"
                    deleteMessageButton.setAttribute("key", item.id)
                    deleteMessageButton.addEventListener('click', (e) => {
                        Swal.fire({
                            title: translation.deleteMessage,
                            text: translation.sureAboutDeleteMessage,
                            icon: 'warning',
                            showCancelButton: true,
                            reverseButtons: true,
                            confirmButtonColor: '#3085d6',
                            cancelButtonColor: '#d33',
                            cancelButtonText: translation.confirmCancel,
                            confirmButtonText: translation.confirmDelete,
                            customClass: {
                                confirmButton: 'custom-confirm-button-sa',
                                cancelButton: 'custom-cancel-button-sa'
                            }
                        }).then((result) => {
                            if (result.isConfirmed) {
                                item.deleted = true;
                                ChromeUtils.updateItem(item)
                                clearTimeOutItem(item.id)
                                SwalUtils.showToastMessage('bottom-end', 5 * Globals.SECOND, true, translation.deletedSuccessfullyMessage)
                            }

                        })
                    })
                    const editMessageButton = document.createElement('button')
                    editMessageButton.textContent = "ערוך"
                    editMessageButton.className = "custom-edit-button"
                    editMessageButton.addEventListener('click', async () => {
                        await openSchedulerModal({type:Globals.EDIT_MESSAGE , itemId :item.id})

                    })
                    //editMessageButton.setAttribute("key", item.id)
                    iconPlaceElement.insertBefore(deleteMessageButton, iconPlaceElement.firstChild);
                    iconPlaceElement.insertBefore(editMessageButton, iconPlaceElement.firstChild);
                }
                //contact image
                newCellFrame.childNodes[0].childNodes[0].childNodes[0].childNodes[0].childNodes[0].src = item.imageUrl;
                return newCellFrame;
            }
        } else {
            emptyMessagesAlert = document.createElement('div');
            emptyMessagesAlert.className = "empty-scheduler-messages";
            emptyMessagesAlert.innerHTML = translation.arentScheduledMessages
            messagesList.appendChild(emptyMessagesAlert)
        }
    }

}


async function addSchedulerButton() {
    const composeBoxElement = document.querySelector(WhatsAppGlobals.composeBoxElement)
    if (composeBoxElement) {
        if (!clockIcon) {
            const pttElement = composeBoxElement.childNodes[1].childNodes[0].childNodes[1].childNodes[1];
            clockIcon = pttElement.cloneNode(true)
            clockIcon.id = "clock-icon"
            clockIcon.title = translation.scheduleMessage
            const buttonChild = clockIcon.childNodes[0]
            const spanChild = buttonChild.childNodes[0]
            buttonChild.setAttribute('data-testid', 'scheduler-btn');
            buttonChild.setAttribute('aria-label', translation.scheduleMessage);
            spanChild.setAttribute('data-testid', 'scheduler');
            spanChild.setAttribute('data-icon', 'scheduler');
            if (spanChild.classList.length === 2) {
                spanChild.classList.remove(spanChild.classList[1])
            }
            const svgElement = clockIcon.childNodes[0].childNodes[0].childNodes[0]
            svgElement.style.width = "30px"
            svgElement.style.height = "30px"
            svgElement.style.marginTop = "10px"
            svgElement.style.marginLeft = "15px"
            const svgPathElement = clockIcon.childNodes[0].childNodes[0].childNodes[0].childNodes[0];
            svgPathElement.setAttribute("d", Globals.CLOCK_SVG_PATH_VALUE);
        }
        composeBoxElement.childNodes[1].childNodes[0].childNodes[1].appendChild(clockIcon)
        clockIcon.removeEventListener('click', () => {
        });
        clockIcon.addEventListener('click', () => {
            clockIcon.disabled = true
            openSchedulerModal({type:Globals.NEW_MESSAGE});
        });

    }


}


async function handleSendButtonClick(data) {
    let scheduleMessageWarning = {show: false, warningMessage: Globals.MESSAGE_MISSING_TEXT};
    const schedulerModal = document.getElementsByClassName('scheduler-modal-container')[0];
    let message = schedulerModal.querySelector('#message').value.trim();
    const date = schedulerModal.querySelector('#datepicker').value;
    const hour = schedulerModal.querySelector('#hour').value;
    let minute = schedulerModal.querySelector('#minute').value;
    if (minute < 10) {minute = "0" + minute;}
    const dateTimeStr = date + " " + hour + ":" + minute;
    let scheduledTime = (new Date(dateTimeStr)).getTime();
    if (scheduledTime <= Date.now()) {scheduledTime = new Date().getTime()}
    if (message.length === 0) {
        scheduleMessageWarning.show = true;
    }
    await clearSchedulerModal();
    if (!scheduleMessageWarning.show) {
        if (data.type === Globals.NEW_MESSAGE) {
            ChromeUtils.getSchedulerMessages().then((schedulerMessages) => {
                // const id = schedulerMessages.length > 0 ? (schedulerMessages[schedulerMessages.length - 1].id) + 1 : 0;
                const id = schedulerMessages.length === 0 ? 0 : schedulerMessages.length;
                console.log("new message id is: " + id)
                saveNewMessage(id, message, scheduledTime, dateTimeStr).then((result) => {
                }).catch((error) => {
                    console.log(error)
                })
            }).catch((onerror) => {
                console.log(onerror.message)
            })
        }
        if (data.type === Globals.EDIT_MESSAGE) {
            ChromeUtils.getScheduleMessageById(data.itemId).then(result => {
                let updatedItem = result;
                updatedItem.message = message;
                updatedItem.scheduledTime = scheduledTime;
                updatedItem.dateTimeStr = dateTimeStr;
                ChromeUtils.updateItem(updatedItem).then(r => {
                    console.log(r)
                    initMessagesTimeOut()
                    // TODO : change text message
                })
            })
        }
    }
    else {
        showErrorMessage(scheduleMessageWarning.warningMessage)
    }

}


const sendMessage = async (id) => {
    const item = await ChromeUtils.getScheduleMessageById(id)
    if (client.state === Globals.SENDING_STATE) {
        const sendingInterval = setInterval(() => {
            if (client.state === Globals.UNUSED_STATE) {
                clearInterval(sendingInterval)
                sendMessage(id)
            }
        }, 50)
    } else {
        client.state = Globals.SENDING_STATE;
        return new Promise(((resolve, reject) => {
            if (item.type === Globals.CONTACT_PARAM) {
                console.log("starting to sending message to id: " + id)
                client.sendingType = Globals.SINGLE_CONTACT_SENDING;
                let element = document.createElement("a");
                element.href = `https://api.whatsapp.com/send?phone=${item.media}&text=${item.message}`;
                element.id = "mychat";
                document.body.append(element);
                let p1 = document.getElementById("mychat");
                p1.click();
                const waitForChatInterval = setInterval(() => {
                    const chatDetails = GeneralUtils.getChatDetails();
                    if (chatDetails.chatId === item.chatId) {
                        clearInterval(waitForChatInterval)
                        const waitForTextInterval = setInterval(async () => {
                            const composeBoxElement = document.querySelector(WhatsAppGlobals.composeBoxElement);
                            if (composeBoxElement) {
                                let textInput = document.querySelectorAll('[class*="text-input"]')[1]
                                let textContext = textInput.childNodes[0].childNodes[0].childNodes[0].textContent;
                                if (textContext === item.message) {
                                    clearInterval(waitForTextInterval)
                                    waitForNodeWithTimeOut(document.body, 'span[data-testid="send"]', 2500)
                                        .then(sendElement => {
                                            sendElement.click();
                                            p1.remove();
                                            item.messageSent = true;
                                            ChromeUtils.updateItem(item)
                                            client = {state: Globals.UNUSED_STATE, sendingType: ""}
                                            resolve(true)
                                        })
                                        .catch(error => {
                                            console.log(error)
                                            reject(false)
                                        });

                                } else {
                                    GeneralUtils.simulateKeyPress('keydown', "Escape");
                                    await GeneralUtils.sleep(1)
                                    p1.click();
                                }
                            }
                        }, 50)
                    }
                }, 300)
            }
        }))
    }

}

async function saveNewMessage(id, message, scheduledTime, dateTimeStr) {
    return new Promise(async (resolve, reject) => {
        try {
            const conversationHeaderElement = document.querySelector('header[data-testid="conversation-header"]');
            const titleElement = document.querySelector('span[data-testid="conversation-info-header-chat-title"]');
            const chatName = titleElement.textContent
            const emojiElement = titleElement.firstElementChild;
            let emojiAttr = null;
            if (emojiElement) {
                const emojiBackgroundPosition = window.getComputedStyle(emojiElement).getPropertyValue('background-position')
                emojiAttr = {
                    src: emojiElement.src,
                    alt: emojiElement.alt,
                    className: emojiElement.className,
                    backgroundPosition: emojiBackgroundPosition
                }
            }
            let chatTitleElement = {chatName, emojiAttr}
            const imageUrl = conversationHeaderElement.childNodes[0].childNodes[0].childNodes[0].src;
            const elapsedTime = scheduledTime - Date.now();
            const notifyBeforeSending = elapsedTime > Globals.USER_TYPING_WARNING_TIME * Globals.SECOND
            const data = {
                id,
                message,
                scheduledTime,
                chatId: currentChatDetails.chatId,
                media: currentChatDetails.media,
                type: currentChatDetails.type,
                imageUrl,
                chatTitleElement,
                dateTimeStr,
                notifyBeforeSending,
                messageSent: false,
                deleted: false
            };
            console.log(data);
            const currentSchedulerMessages = await ChromeUtils.getSchedulerMessages();
            const updatedSchedulerMessages = [...currentSchedulerMessages, data];
            ChromeUtils.updateSchedulerMessages(updatedSchedulerMessages).then(r => {
                console.log(r)
            });
            await setTimeOutForMessage(id, chatName, elapsedTime, notifyBeforeSending);
            resolve(true);
        } catch (error) {
            console.log(error)
        }
    });
}


async function checkForUserTyping(seconds) {
    let userIsTyping = false;
    let initialTexts = await getAllTexts().then(result => result.sort());
    return new Promise(resolve => {
        const typeCheckingInterval = setInterval(() => {
            seconds--;
            if (seconds <= 0 || userIsTyping) {
                clearInterval(typeCheckingInterval);
                resolve(userIsTyping);
            } else {
                getAllTexts().then(currentTexts => {
                    let equals = GeneralUtils.areArrayEqual(currentTexts.sort(), initialTexts);
                    if (!equals) {
                        userIsTyping = true;
                    }
                });
            }
        }, Globals.SECOND);
    });

    function getAllTexts() {
        return new Promise(resolve => {
            const texts = [];
            const inputs = document.querySelectorAll('[class*="text-input"]');
            inputs.forEach(input => {
                texts.push(input.textContent);
            });
            resolve(texts);
        });
    }
}


function setTimeOutForMessage(id, chatName, elapsedTime, notifyBeforeSending) {
    if (notifyBeforeSending) {
        activeMessagesTimeout[id] = setTimeout(async () => {
            let userIsTyping = await checkForUserTyping(Globals.USER_TYPING_WARNING_TIME)
            if (userIsTyping) {
                showUserTypingAlert(Globals.USER_TYPING_WARNING_TIME * Globals.SECOND, chatName)
                await GeneralUtils.sleep(Globals.USER_TYPING_WARNING_TIME)
            }
            startMessageSending(id)
        }, elapsedTime - (Globals.USER_TYPING_WARNING_TIME * Globals.SECOND))
    } else {
        activeMessagesTimeout[id] = setTimeout(() => {
            startMessageSending(id)
        }, elapsedTime)
    }

}

function startMessageSending(id) {
    sendMessage(id).then((result) => {
        console.log("send message function done , result: " + result);
        delete activeMessagesTimeout[id]
        console.log(activeMessagesTimeout)
    })
}


function waitForNode(parentNode, selector) {
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            const element = parentNode.querySelector(selector);
            if (element) {
                clearInterval(interval);
                resolve(element);
            }
        }, 50);
    });
}

function waitForNodeWithTimeOut(parentNode, selector, timeout) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > timeout) {
                clearInterval(interval);
            }
            const element = parentNode.querySelector(selector);
            if (element) {
                clearInterval(interval);
                resolve(element);
            }
        }, 10);
    });
}


function addSelectOptions(selector, selectorName) {
    const optionLength = (selectorName === 'hour') ? 24 : 60;

    function addOption(value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.text = text;
        selector.add(option);
    }

    if (selector.options.length !== optionLength) {
        selector.options.length = 0;
        for (let i = 0; i < optionLength; i++) {
            if (i < 10) {
                addOption(i, "0" + i);
            } else {
                addOption(i, i);
            }
        }
    }
}



function showUserTypingAlert(timer, contactName) {
    let timerInterval
    Swal.fire({
        title: ` ${translation.scheduledMessageTo} ${contactName}`,
        html: 'ההודעה תשלח בעוד <b></b> שניות',
        timer: timer,
        timerProgressBar: false,
        didOpen: () => {
            //Swal.showLoading()
            const b = Swal.getHtmlContainer().querySelector('b')
            timerInterval = setInterval(() => {
                b.textContent = Math.ceil(Swal.getTimerLeft() / 1000).toString()
            }, 1000)
        },
        willClose: () => {
            clearInterval(timerInterval)
        }
    }).then((result) => {
        if (Swal.DismissReason.timer) {
            console.log('I was closed by the timer')
        }
    })
}

const showErrorMessage = (message) => {
    Swal.fire({
        icon: 'error',
        title: translation.oops,
        text: message,
    }).then()
}


const showSentMessagesPopup = (unSentMessages) => {
    const container = document.createElement("div");
    container.className = "un-sent-container";
    const headline = document.createElement("div");
    headline.innerText = translation.unSendingMessage;
    headline.style.fontWeight = "600";
    headline.style.fontSize = "0.8em"
    container.appendChild(headline);
    unSentMessages.forEach((item, index) => {
        let divItem = document.createElement('div')
        divItem.className = "un-sent-message";
        divItem.innerText = `${index + 1}) ${item.chatTitleElement.chatName} (${item.message})`
        divItem.style.marginTop = "0.8em"
        container.appendChild(divItem)
    })
    Swal.fire({
        title: translation.scheduledMessages,
        html: container,
        icon: 'info',
        reverseButtons: true,
        showCancelButton: true,
        confirmButtonText: translation.confirmSending,
        cancelButtonText: translation.confirmCancel
    }).then((result) => {
        if (result.isConfirmed) {
            unSentMessages.forEach(item => {
                sendMessage(item.id).then(() => {
                    console.log("message has been sent number: " + item.id)
                })
            })
        }
        if (result.isDismissed) {
            unSentMessages.forEach(item => {
                item.deleted = true;
                ChromeUtils.updateItem(item).then(r => {
                })
            })
        }
    });

}


/// scrolling chat list
// let foundElement = false;
// let listItems
// const scrollerContainer = document.getElementById('pane-side');
// //scroll the top of the pane side
// const chatListElement = scrollerContainer.querySelector('div[data-testid="chat-list"]');
// const chatListContainer = chatListElement.childNodes[0];
// while (!foundElement) {
//     listItems = chatListContainer.childNodes;
//     const scrollValue = scrollerContainer.offsetHeight;
//     listItems.forEach((item) => {
//         const chatTile = item.querySelector('div[data-testid="cell-frame-title"]').firstElementChild.firstElementChild;
//         const chatName = chatTile.getAttribute('title');
//         console.log(chatName)
//         if (chatName === groupName) {
//             item.scrollIntoView();
//             foundElement = true;
//         }
//     });
//     console.log("finish to read list")
//     if (!foundElement){
//         scrollerContainer.scrollTop += scrollValue;
//         await GeneralUtils.sleep(1)
//     }
// }
