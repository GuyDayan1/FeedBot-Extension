import * as ChromeUtils from "./utils/chrome-utils";
import * as GeneralUtils from "./utils/general-utils"
import * as Globals from "./utils/globals"
import {CONTACT_PARAM} from "./utils/globals"
import * as WhatsAppGlobals from './utils/whatsappglobals'
import * as ExcelUtils from "./utils/excel-utils";
import Swal from "sweetalert2";


let headerElement;
let cellFrameElement;
let connected = false;
let completeStatusCounter = 0;
let currentChatDetails = {type: "", media: "", chatId: ""}
let client = {state: Globals.UNUSED_STATE, sendingType: "", language: ""};
let bulkSendingData;
let feedBotIcon;
let load = false;
let emptyMessagesAlert;
let modalBackdrop;
let clockIcon;
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

            feedBotListOptions.push(translation.scheduledMessages, translation.bulkSending, translation.exportToExcel)
            excelFeaturesListOptions.push(translation.contacts, translation.participantsFromAllGroups, translation.participantsFromSelectedGroups)
            //ChromeUtils.clearStorage()
        }

    });
    headerElementObserver.observe(document.body, {childList: true, subtree: true});
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
            await setTimeOutForMessage(currentMessage.id, currentMessage.chatTitleElement.chatName, elapsedTime, currentMessage.warnBeforeSending);
        }
        if (unSentMessages.length > 0) {
            showSentMessagesPopup(unSentMessages)
        }
    })
}


function chatListener() {
    waitForNode(document.body, WhatsAppGlobals.paneSideElement).then(r => {
        document.body.addEventListener('click', (e) => {
            waitForNodeWithTimeOut(document.body, WhatsAppGlobals.conversationHeaderElement, 3000).then(async (element) => {
                currentChatDetails = GeneralUtils.getChatDetails();
                waitForNodeWithTimeOut(document.body, WhatsAppGlobals.composeBoxElement, 3000)
                    .then((element) => {
                        const clockIcon = document.getElementById("clock-icon");
                        if (!clockIcon && currentChatDetails.type === CONTACT_PARAM) {
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
                feedBotListItem.addEventListener("click", () => {
                    showScheduledMessages()
                })
                break;
            case translation.bulkSending:
                feedBotListItem.addEventListener('click', () => {
                    showBulkSendingModal()
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
                            excelListItem.addEventListener("click", exportAllGroupsParticipantsToExcel)
                            break;
                        case translation.participantsFromSelectedGroups:
                            excelListItem.addEventListener("click", getSelectedGroupsParticipants)
                            break;
                        case translation.contacts:
                            excelListItem.addEventListener("click", showContactsModal)
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


async function getSelectedGroupsParticipants() {
    const modelStorageDB = await GeneralUtils.getDB("model-storage")
    await GeneralUtils.getObjectStoresByKeyFromDB(modelStorageDB, 'group-metadata').then((response) => {
        const result = response.result;
        const filteredResult = result.filter(item => item.a_v_id != null);
        const groupsData = filteredResult.map(item => ({groupName: item.subject, groupId: item.id}));
        showGroupsModal(groupsData)
    })

}

async function exportContactsToExcel(selectedOption) {
    const modelStorageDB = await GeneralUtils.getDB("model-storage")
    switch (selectedOption) {
        case Globals.SAVED_PARAM :
            await GeneralUtils.getObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact', 1).then((response) => {
                const result = response.result;
                const savedContacts = result.map(item => {
                    const phoneNumber = item.id.split('@')[0];
                    const phoneBookContactName = item.name || '';
                    const whatsappUserName = item.pushname || '';
                    return {phoneNumber, phoneBookContactName, whatsappUserName}
                })
                const headers = [translation.phoneNumber, translation.contactName, translation.whatsappUsername]

                ExcelUtils.exportToExcelFile(savedContacts, translation.savedContacts, headers)

            })
            break;
        case Globals.UN_SAVED_PARAM:
            await GeneralUtils.getObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact', 0).then((response) => {
                const result = response.result;
                const unSavedContacts = result.map(item => {
                    const phoneNumber = item.id.split('@')[0];
                    const pushName = item.pushname || ''
                    return {phone: phoneNumber, name: pushName};
                })
                const headers = [translation.phoneNumber, translation.contactName]
                ExcelUtils.exportToExcelFile(unSavedContacts, translation.unSavedContacts, headers)
            })
            break;
        case Globals.ALL_PARAM:
            await GeneralUtils.getAllObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact').then((response) => {
                const result = response.result;
                const both = result.map(item => {
                    const phoneNumber = item.id.split('@')[0];
                    const phoneBookContactName = item.name || '';
                    const whatsappUserName = item.pushname || '';
                    return {phoneNumber, phoneBookContactName, whatsappUserName}
                })
                const headers = [translation.phoneNumber, translation.contactName, translation.whatsappUsername]
                ExcelUtils.exportToExcelFile(both, translation.savedAndUnSavedContacts, headers)
            })

    }

}

const getAllParticipantsFromIndexDB = async () => {
    let items;
    const modelStorageDB = await GeneralUtils.getDB("model-storage")
    await GeneralUtils.getObjectStoresByKeyFromDB(modelStorageDB, 'participant').then((response) => {
        items = response.result;
    })
    return items;
}

async function exportParticipantsByGroupIdsToExcel(groupsId) {
    let items = await getAllParticipantsFromIndexDB()
    let filteredItems = items.filter(item => {
        return ((groupsId.includes(item.groupId)) && (item.participants.length > 0 || true))
    })
    const participants = filteredItems.map(item => {
        return item.participants
    }).flat();
    const uniqueParticipants = [...new Set(participants)]
    const phones = uniqueParticipants.map(chatId => {
        return chatId.toString().split('@')[0]
    })
    let data = await addContactsNames(phones)
    const headers = [translation.phoneNumber, translation.contactName]
    ExcelUtils.exportToExcelFile(data, translation.participantsByGroups, headers)
}

async function addContactsNames(phones) {
    let newArray;
    const modelStorageDB = await GeneralUtils.getDB("model-storage")
    await GeneralUtils.getAllObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact').then((response) => {
        const result = response.result;
        newArray = phones.map(phone => {
            const item = result.find(item => item.id.toString().split('@')[0] === phone);
            let name = '';
            if (item) {
                name = item.isAddressBookContact === 1 ? item.name : item.pushname || ''
            }
            return {phone: phone, name: name}
        });
    })
    return newArray;
}


async function exportAllGroupsParticipantsToExcel() {
    let items = await getAllParticipantsFromIndexDB()
    let participants = items.map(item => {
        if (item.participants.length > 0 || true) {
            return item.participants;
        }
    }).flat();
    const uniqueParticipants = [...new Set(participants)]
    let phones = uniqueParticipants.map(chatId => {
        return chatId.split('@')[0]
    })
    let phonesObjects = phones.map(phone => ({phone})); // must convert to object like phone:"972546432705"
    ExcelUtils.exportToExcelFile(phonesObjects, translation.phonesFromAllGroups)

}

function refreshScheduledMessagesList() {
    let schedulerMessages = document.getElementsByClassName('scheduler-messages-container')[0]
    if (schedulerMessages) {
        schedulerMessages.remove()
        showScheduledMessages().then(r => () => {
            console.log("done reset messages")
        })
    }
}

async function showScheduledMessages() {
    let schedulerMessagesExist = document.getElementsByClassName('scheduler-messages-container')[0]
    if (!schedulerMessagesExist) {
        const paneSideElement = document.querySelector(WhatsAppGlobals.paneSideElement)
        const schedulerListContainer = document.createElement("div");
        schedulerListContainer.className = "scheduler-messages-container";
        const backToChatList = document.createElement('div')
        backToChatList.className = "back-to-chat-list";
        backToChatList.innerText = translation.backToChat
        const messagesList = document.createElement("div");
        messagesList.className = "messages-list";
        GeneralUtils.addScrollingAbility(messagesList, "432px")
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
                const clickListener = (event) => {
                };
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
                    deleteMessageButton.textContent = translation.deleteText
                    deleteMessageButton.className = "fb-custom-cancel-button"
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
                        }).then((result) => {
                            if (result.isConfirmed) {
                                item.deleted = true;
                                ChromeUtils.updateItem(item)
                                clearTimeOutItem(item.id)
                                showToastMessage('bottom-end', 5 * Globals.SECOND, true, translation.messageDeletedSuccessfully)
                            }

                        })
                    })
                    const editMessageButton = document.createElement('button')
                    editMessageButton.textContent = translation.edit
                    editMessageButton.className = "custom-edit-button"
                    editMessageButton.addEventListener('click', async () => {
                        await showSchedulerModal({type: Globals.EDIT_MESSAGE, itemId: item.id})
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
            showSchedulerModal({type: Globals.NEW_MESSAGE})
        });

    }


}


async function handleConfirmButtonClick(messageData) {
    if (!messageData.scheduleMessageWarning.show) {
        if (messageData.messageType === Globals.NEW_MESSAGE) {
            ChromeUtils.getSchedulerMessages().then((schedulerMessages) => {
                const id = schedulerMessages.length === 0 ? 0 : schedulerMessages.length;
                console.log("new message id is: " + id)
                saveMessage(id, messageData.messageText, messageData.scheduledTime, messageData.dateTimeStr).then((result) => {
                    showToastMessage('bottom-end', 5 * Globals.SECOND, false, translation.messageSavedSuccessfully)
                }).catch((error) => {
                    console.log(error)
                })
            }).catch((onerror) => {
                console.log(onerror.message)
            })
        }
        if (messageData.messageType === Globals.EDIT_MESSAGE) {
            ChromeUtils.getScheduleMessageById(messageData.itemId).then(result => {
                let updatedItem = result;
                updatedItem.message = messageData.messageText;
                updatedItem.scheduledTime = messageData.scheduledTime;
                updatedItem.dateTimeStr = messageData.dateTimeStr;
                ChromeUtils.updateItem(updatedItem).then(r => {
                    initMessagesTimeOut()
                    refreshScheduledMessagesList()
                })
            })
        }
    } else {
        showErrorMessage(messageData.scheduleMessageWarning.warningMessage)
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
        return new Promise((async (resolve, reject) => {
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
            if (item.type === Globals.GROUP_PARAM) {
                await searchingForGroup(item.media)
            }
        }))
    }

}

async function searchingForGroup(media) {
    let side = document.getElementById('pane-side')
    side.scrollTop -= side.scrollTop /// scroll to top


}

function simulateTyping(inputElement, text) {
    let index = 0;

    function typeNextChar() {
        if (index < text.length) {
            const char = text.charAt(index);
            const keyCode = char.charCodeAt(0);
            const event = new KeyboardEvent('keydown', {keyCode});
            inputElement.dispatchEvent(event);
            index++;
            setTimeout(typeNextChar, 100);
        }
    }

    typeNextChar();
}


async function saveMessage(id, message, scheduledTime, dateTimeStr) {
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
            const warnBeforeSending = elapsedTime > Globals.USER_TYPING_WARNING_TIME * Globals.SECOND
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
                warnBeforeSending,
                messageSent: false,
                deleted: false
            };
            console.log(data);
            const currentSchedulerMessages = await ChromeUtils.getSchedulerMessages();
            const updatedSchedulerMessages = [...currentSchedulerMessages, data];
            ChromeUtils.updateSchedulerMessages(updatedSchedulerMessages).then(r => {
                console.log(r)
            });
            await setTimeOutForMessage(id, chatName, elapsedTime, warnBeforeSending);
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


function setTimeOutForMessage(id, chatName, elapsedTime, warnBeforeSending) {
    if (warnBeforeSending) {
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
    headline.innerText = translation.unSentMessage;
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
        cancelButtonText: translation.confirmCancel,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33'
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


const showBulkSendingModal = async () => {
    let finalData;
    try {
        const bulkSendingModalHTML = await ChromeUtils.sendChromeMessage('get-bulk-sending-modal');
        Swal.fire({
            title: translation.bulkSending,
            html: bulkSendingModalHTML,
            allowOutsideClick: false,
            showCancelButton: true,
            showCloseButton: true,
            reverseButtons: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            cancelButtonText: translation.confirmCancel,
            confirmButtonText: translation.approve,
        }).then((result) => {
            if (result.isConfirmed) {
                // TODO : start bulking sending with finalData
            }
        });
        const confirmButton = Swal.getConfirmButton();
        confirmButton.disabled = true;
        const fileInput = document.getElementById('excel-file');
        fileInput.addEventListener('change', async () => {
            let body = document.getElementsByClassName('bulk-sending-modal-container')[0];
            const selectedFile = fileInput.files[0];
            const fileName = selectedFile.name;
            const fileSuffix = fileName.split('.').pop().toLowerCase();
            if (fileSuffix === 'csv') {
                Swal.resetValidationMessage()
                ExcelUtils.readExcelFile(selectedFile).then((result) => {
                    let data = result.data;
                    let wrongNumbers;
                    finalData = data.map(item=>{
                        let phone = item.colA;
                        if (phone){
                            item.colA = GeneralUtils.formatPhone(phone)
                        }
                        return item;
                    })
                    let tableContainer = document.createElement('div');
                    tableContainer.className = "fb-table-container";
                    if (client.language === Globals.HEBREW_LANGUAGE_PARAM) {tableContainer.style.direction = "ltr"}
                    let bulkTable = GeneralUtils.createTable(result.headers,finalData)
                    tableContainer.appendChild(bulkTable)
                    body.appendChild(tableContainer)
                    confirmButton.disabled = false; // Enable the "OK" button
                })
            } else {
                Swal.showValidationMessage(translation.fileMustToBeCSV);
                let tableBody = document.getElementsByClassName('fb-table-container')[0]
                if (body){tableBody.remove()}
                confirmButton.disabled = true; // Enable the "OK" button
            }
        });
    } catch (error) {
        console.error(error);
    }
}


const showSchedulerModal = async (data) => {
    const container = document.createElement("div");
    container.className = "scheduler-modal-container";
    const messageTextArea = document.createElement("textarea");
    messageTextArea.id = "message"
    messageTextArea.className = "fb-textarea";
    messageTextArea.placeholder = translation.messageContent
    const schedulerTimeContainer = document.createElement('div');
    schedulerTimeContainer.className = 'scheduler-time-container';
    const minuteContainer = document.createElement('div');
    minuteContainer.className = 'minute-container';
    const minuteLabel = document.createElement('label');
    minuteLabel.htmlFor = 'minute';
    minuteLabel.textContent = 'דקה';
    const minuteDropdown = document.createElement('select');
    minuteDropdown.name = 'minutePicker';
    minuteDropdown.id = 'minute';
    minuteDropdown.className = 'custom-dropdown';
    minuteContainer.appendChild(minuteLabel);
    minuteContainer.appendChild(minuteDropdown);
    const hourContainer = document.createElement('div');
    hourContainer.className = 'hour-container';
    const hourLabel = document.createElement('label');
    hourLabel.htmlFor = 'hour';
    hourLabel.textContent = 'שעה';
    const hourDropdown = document.createElement('select');
    hourDropdown.name = 'hourPicker';
    hourDropdown.id = 'hour';
    hourDropdown.className = 'custom-dropdown';
    hourContainer.appendChild(hourLabel);
    hourContainer.appendChild(hourDropdown);
    const dateContainer = document.createElement('div');
    dateContainer.className = 'date-container';
    const dateLabel = document.createElement('label');
    dateLabel.htmlFor = 'datepicker';
    dateLabel.textContent = 'תאריך';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.name = 'datePicker';
    dateInput.id = 'datepicker';
    dateInput.className = 'custom-date-input';
    dateContainer.appendChild(dateLabel);
    dateContainer.appendChild(dateInput);
    schedulerTimeContainer.appendChild(minuteContainer);
    schedulerTimeContainer.appendChild(hourContainer);
    schedulerTimeContainer.appendChild(dateContainer);
    addSelectOptions(hourDropdown, "hour")
    addSelectOptions(minuteDropdown, "minute")
    if (data.type === Globals.NEW_MESSAGE) {
        let currentDate = new Date();
        dateInput.value = currentDate.toISOString().slice(0, 10);
        hourDropdown.selectedIndex = currentDate.getHours();
        minuteDropdown.selectedIndex = currentDate.getMinutes()
        let textInput = document.querySelectorAll('[class*="text-input"]')[1];
        if (textInput.textContent !== chatInputPlaceholder) {
            messageTextArea.value = textInput.textContent
        }
    }
    if (data.type === Globals.EDIT_MESSAGE) {
        const item = await ChromeUtils.getScheduleMessageById(data.itemId)
        let date = new Date(item.scheduledTime)
        dateInput.value = date.toISOString().slice(0, 10);
        hourDropdown.selectedIndex = date.getHours();
        minuteDropdown.selectedIndex = date.getMinutes()
        messageTextArea.value = item.message;
    }
    container.appendChild(messageTextArea)
    container.appendChild(schedulerTimeContainer)
    Swal.fire({
        title: translation.scheduleMessage,
        html: container,
        showCancelButton: true,
        showCloseButton: true,
        reverseButtons: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        cancelButtonText: translation.confirmCancel,
        confirmButtonText: translation.approve,
    }).then(async (result) => {
        if (result.isConfirmed) {
            let scheduleMessageWarning = {show: false, warningMessage: Globals.MESSAGE_MISSING_TEXT};
            let messageText = messageTextArea.value.trim();
            if (messageText.length === 0) {
                scheduleMessageWarning.show = true;
            }
            let date = dateInput.value;
            let hour = hourDropdown.value;
            let minute = minuteDropdown.value;
            if (minute < 10) {
                minute = "0" + minute;
            }
            const dateTimeStr = date + " " + hour + ":" + minute;
            let scheduledTime = (new Date(dateTimeStr)).getTime();
            if (scheduledTime <= Date.now()) {
                scheduledTime = new Date().getTime()
            }
            let messageData
            if (data.type === Globals.NEW_MESSAGE) {
                messageData = {
                    messageType: Globals.NEW_MESSAGE,
                    scheduleMessageWarning,
                    messageText,
                    dateTimeStr,
                    scheduledTime
                }
            }
            if (data.type === Globals.EDIT_MESSAGE) {
                messageData = {
                    messageType: Globals.EDIT_MESSAGE,
                    itemId: data.itemId,
                    scheduleMessageWarning,
                    messageText,
                    dateTimeStr,
                    scheduledTime
                }
            }
            await handleConfirmButtonClick(messageData)
        }
    })
}
const showGroupsModal = (result) => {
    const container = document.createElement("div");
    container.className = "groups-modal-container";
    const contactsBody = document.createElement("div")
    contactsBody.className = "groups-body";
    for (let item of result) {
        let div = document.createElement('div')
        div.className = "checkbox-container";
        let checkboxInput = document.createElement('input')
        checkboxInput.type = "checkbox"
        checkboxInput.name = item.groupName;
        checkboxInput.value = item.groupId
        let checkboxLabel = document.createElement('label')
        checkboxLabel.classList.add('fb-label');
        checkboxLabel.setAttribute('for', item.groupName)
        checkboxLabel.innerText = item.groupName;
        div.appendChild(checkboxInput)
        div.appendChild(checkboxLabel)
        contactsBody.appendChild(div)
        container.appendChild(contactsBody)
    }
    Swal.fire({
        title: translation.chooseFromFollowingOptions,
        html: container,
        allowOutsideClick: false,
        showCancelButton: true,
        showCloseButton: true,
        reverseButtons: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        cancelButtonText: translation.confirmCancel,
        confirmButtonText: translation.approve,
        preConfirm: () => {
            const checkboxes = contactsBody.querySelectorAll("input[type=checkbox]");
            const checkboxesArray = Array.from(checkboxes);
            const checkedCheckboxes = checkboxesArray.filter(checkbox => checkbox.checked);
            const checkedValues = checkedCheckboxes.map(checkbox => checkbox.value);
            if (checkedValues.length > 0) {
                console.log('Selected option:', checkedValues);
                return checkedValues;
            } else {
                // Show an error message and prevent modal from closing
                Swal.showValidationMessage(translation.mustToChooseAtLeastOneOption);
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const groupsId = result.value;
            exportParticipantsByGroupIdsToExcel(groupsId).then(r => {
                console.log("export successfully")
            })
        }
    });


}
const showContactsModal = () => {
    const container = document.createElement("div");
    container.className = "contacts-modal-container";
    const contactsBody = document.createElement("div")
    contactsBody.className = "contacts-body";
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = translation.chooseOneFromFollowingOptions;
    fieldset.appendChild(legend);
    const contactsOptions = [Globals.SAVED_PARAM, Globals.UN_SAVED_PARAM, Globals.ALL_PARAM];
    contactsOptions.forEach((option) => {
        const div = document.createElement('div');
        div.classList.add('contacts-row');
        const label = document.createElement('label');
        label.classList.add('fb-label');
        const input = document.createElement('input');
        input.classList.add('fb-radio-button');
        input.type = 'radio';
        input.name = 'contacts';
        input.value = option;
        label.appendChild(input);
        let text;
        if (option === Globals.SAVED_PARAM) {
            text = translation.savedContacts
        }
        if (option === Globals.UN_SAVED_PARAM) {
            text = translation.unSavedContacts
        }
        if (option === Globals.ALL_PARAM) {
            text = translation.savedAndUnSavedContacts
        }
        label.appendChild(document.createTextNode(text))
        div.appendChild(label);
        fieldset.appendChild(div);
    });
    contactsBody.appendChild(fieldset)
    container.appendChild(contactsBody)
    Swal.fire({
        title: translation.contacts,
        html: container,
        allowOutsideClick: false,
        showCancelButton: true,
        showCloseButton: true,
        reverseButtons: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        cancelButtonText: translation.confirmCancel,
        confirmButtonText: translation.approve,
        preConfirm: () => {
            const radioButtons = document.getElementsByName('contacts');
            let selectedOption;
            for (const radioBtn of radioButtons) {
                if (radioBtn.checked) {
                    selectedOption = radioBtn.value;
                    break;
                }
            }
            if (selectedOption) {
                console.log('Selected option:', selectedOption);
                return selectedOption;
            } else {
                // Show an error message and prevent modal from closing
                Swal.showValidationMessage('יש לבחור אחת מהאפשרויות');
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const selectedOption = result.value;
            exportContactsToExcel(selectedOption).then(r => () => {
                console.log(selectedOption)
            })
        }
    });
}


const showToastMessage = (position, timer, timerProgressBar, title) => {
    const Toast = Swal.mixin({
        toast: true,
        position: position,
        showConfirmButton: false,
        timer: timer,
        timerProgressBar: timerProgressBar,
        didOpen: (toast) => {
            // toast.addEventListener('mouseenter', Swal.stopTimer)
            // toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    })

    Toast.fire({
        icon: 'success',
        title: title
    })
}





