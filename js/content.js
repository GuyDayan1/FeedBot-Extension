import * as ChromeUtils from "./utils/chrome-utils";
import * as GeneralUtils from "./utils/general-utils"
import {waitForNode} from "./utils/general-utils"
import * as Globals from "./utils/globals"
import * as WhatsAppGlobals from './utils/whatsappglobals'
import * as ExcelUtils from "./utils/excel-utils";
import * as Errors from "./utils/errors"
import Swal from "sweetalert2";


let headerElement;
let connected = false;
let client = {state: Globals.UNUSED_STATE, sendingType: "", language: ""};
let defaultUserImage;
let feedBotIcon;
let cellFrame;
let emptyMessagesAlert;
let firstLoginDate;
let messagesListHeight;
let contacts;
let clockSvg;
let WAInputPlaceholder = '';
let unSentMessagesIds = []
let activeMessagesTimeout = {};
let translation = {}
let GenericSvgElement;
let feedBotListOptions = [];
let excelFeaturesListOptions = []


const headerElementObserver = new MutationObserver(async () => {
    headerElement = document.querySelector(WhatsAppGlobals.chatListHeaderElement);
    if (headerElement !== null) {
        connected = true;
        headerElementObserver.disconnect();
        await loadExtension().then(async () => {
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
                        GeneralUtils.removeElement('.fb-features-dropdown');
                    }
                })
                window.addEventListener("click", (event) => {
                    const feedBotFeaturesList = document.getElementsByClassName("fb-features-dropdown")[0]
                    if ((!feedBotIcon.contains(event.target)) && (feedBotFeaturesList)) {
                        GeneralUtils.removeElement('.fb-features-dropdown');
                    }
                });
            }
            cellFrame = await ChromeUtils.sendChromeMessage({
                action: Globals.GET_HTML_FILE_ACTION,
                fileName: 'cellframe'
            })
            clockSvg = chrome.runtime.getURL('icons/clock-icon.svg');
            defaultUserImage = chrome.runtime.getURL("images/default-user.png");
            WAInputPlaceholder = translation.typeMessage
            feedBotListOptions.push({id:1,type : Globals.SCHEDULED_MESSAGES_TYPE , text:translation.scheduledMessages , hasSubList:false} ,
                {id:2 , type:Globals.SENDING_BY_PHONE_TYPE , text:translation.sendingByPhoneNumber , hasSubList:false},
                {id:3 , type:Globals.BULK_SENDING_TYPE , text:translation.bulkSending , hasSubList:false},
                {id:4 , type:Globals.EXPORT_TO_EXCEL_TYPE , text:translation.exportToExcel , hasSubList:true},
                {id:4 , type:Globals.SETTINGS_TYPE , text:translation.settings , hasSubList:false});
            excelFeaturesListOptions.push({id:1 , type : Globals.CONTACTS_TYPE , text:translation.contacts},
                {id:2 , type : Globals.PARTICIPANTS_FROM_ALL_GROUPS_TYPE , text:translation.participantsFromAllGroups},
                {id:3 , type : Globals.PARTICIPANTS_FROM_SELECTED_GROUPS_TYPE , text:translation.participantsFromSelectedGroups})
        })
        //ChromeUtils.clearStorage()
    }
});
headerElementObserver.observe(document.body, {childList: true, subtree: true});


const loadExtension = async () => {
    await initTranslations();
    await getContacts();
    await setClientProperties();
    await getSvgWhatsAppElement();
    await initMessagesTimeOut();
    await DOMListener();
};

async function getContacts() {
    let modelStorageDB = await GeneralUtils.getDB("model-storage")
    contacts = await GeneralUtils.getObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact', 1).then((response) => {
        return response.result;
    })

}

function updateClientState(state, sendingType) {
    client.state = state;
    client.sendingType = sendingType;

}

async function setClientProperties() {
    firstLoginDate = await ChromeUtils.getFromLocalStorage('firstLoginDate');
    if (!firstLoginDate) {
        ChromeUtils.clearStorage();
        await ChromeUtils.updateLocalStorage('firstLoginDate', GeneralUtils.getFullDateAsString())
    }
    waitForNode(document.body, WhatsAppGlobals.paneSideElement).then(res => {
        messagesListHeight = res.clientHeight;
    })

}

async function initTranslations() {
    let clientLanguage = localStorage.getItem(WhatsAppGlobals.WA_LANGUAGE_PARAM);
    client.language = clientLanguage.includes(Globals.HEBREW_LANGUAGE_PARAM) ? Globals.HEBREW_LANGUAGE_PARAM : Globals.ENGLISH_LANGUAGE_PARAM;
    let languagePath = `languages/${client.language}.json`;
    let htmlUrl = chrome.runtime.getURL(languagePath);
    const response = await fetch(htmlUrl);
    translation = await response.json();
}


async function initMessagesTimeOut() {
    GeneralUtils.waitForNode(document.body, WhatsAppGlobals.sideElement).then(async () => {
        if (Object.keys(activeMessagesTimeout.length === 0)) {
            await clearAllItemsTimeOuts();
        }
        let schedulerMessages = await ChromeUtils.getSchedulerMessages();
        const now = new Date().getTime();
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
            let currentItem = relevantMessages[i];
            const elapsedTime = currentItem.scheduledTime - Date.now();
            await setTimeOutForMessage(currentItem.id, currentItem.chatName, elapsedTime, currentItem.userInteractWarning);
        }
        if (unSentMessages.length > 0) {
            showUnSentMessagesModal(unSentMessages)
        }
    })
}


function DOMListener() {
    GeneralUtils.waitForNode(document.body, WhatsAppGlobals.sideElement).then(r => {
        document.body.addEventListener('click', (e) => {
            if (unSentMessagesIds.length > 0) {
                ChromeUtils.getSchedulerMessages().then(result => {
                    let unSentMessages = result.filter(item => {
                        return unSentMessagesIds.some(id => id === item.id)
                    })
                    unSentMessagesIds = []
                    showUnSentMessagesModal(unSentMessages)
                })
            }
            GeneralUtils.waitForNodeWithTimeOut(document.body, WhatsAppGlobals.conversationHeaderElement, Globals.SECOND * 5).then(async (element) => {
                let currentChatDetails = await GeneralUtils.getChatDetails()
                addChatFeatures(currentChatDetails)
            }).catch(res => {
                console.log(res)
            })

        })
    })

    function addChatFeatures(currentChatDetails) {
        GeneralUtils.waitForNodeWithTimeOut(document.body, WhatsAppGlobals.composeBoxElement, Globals.SECOND * 3)
            .then((composeBoxElement) => {
                const clockIcon = composeBoxElement.querySelector('#clock-icon');
                if (!clockIcon && currentChatDetails.chatType === Globals.CONTACT_PARAM && currentChatDetails.chatId) {
                    addSchedulerButton()
                }
            })
            .catch((error) => {
                console.log(error)
            });
    }
}



async function clearAllItemsTimeOuts() {
    for (let id in activeMessagesTimeout) {
        await clearSpecificItem(id)
    }
}

async function clearSpecificItem(id) {
    const item = await ChromeUtils.getScheduleMessageById(id)
    item.deleted = true;
    await ChromeUtils.updateItem(item)
    clearTimeout(activeMessagesTimeout[id])
    delete activeMessagesTimeout[id]
}


async function getSvgWhatsAppElement() {
    GenericSvgElement = document.querySelector(WhatsAppGlobals.menuElement)
    GenericSvgElement.removeEventListener('click', () => {
    })
}


async function addFeedBotFeatures() {
    const feedBotListFeatures = document.createElement("ul");
    feedBotListFeatures.className = "fb-features-dropdown";
    feedBotListFeatures.style.marginLeft = client.language === Globals.HEBREW_LANGUAGE_PARAM ? '3rem' : 'auto'
    for (let i = 0; i < feedBotListOptions.length; i++) {
        let feedBotOption = feedBotListOptions[i];
        const feedBotListItem = document.createElement("li");
        feedBotListItem.className = "fb-list-item"
        const textSpan = document.createElement("span");
        textSpan.textContent = feedBotOption.text;
        feedBotListItem.appendChild(textSpan)
        feedBotListFeatures.appendChild(feedBotListItem);
        switch (feedBotOption.type) {
            case Globals.SCHEDULED_MESSAGES_TYPE:
                feedBotListItem.addEventListener("click", () => {showScheduledMessages()})
                break;
            case Globals.SENDING_BY_PHONE_TYPE:
                feedBotListItem.addEventListener('click', () => {showSendByPhoneNumberModal()})
                break;
            case Globals.BULK_SENDING_TYPE:
                feedBotListItem.addEventListener('click', () => {showBulkSendingModal()})
                break;
            case Globals.EXPORT_TO_EXCEL_TYPE:
                const excelSubListFeatures = document.createElement("ul");
                excelSubListFeatures.className = "fb-excel-features-dropdown";
                excelSubListFeatures.style[client.language === Globals.HEBREW_LANGUAGE_PARAM ? 'right' : 'left'] = '100%';
                const arrowSvgData = {
                    data_testid: "arrow",
                    data_icon: "arrow",
                    height: 20,
                    width: 20,
                    d: client.language === Globals.HEBREW_LANGUAGE_PARAM ? Globals.LEFT_ARROW_SVG_PATH_VALUE : Globals.RIGHT_ARROW_SVG_PATH_VALUE
                }
                const arrowElement = createSvgElement(arrowSvgData);
                client.language === Globals.HEBREW_LANGUAGE_PARAM ? arrowElement.style.marginRight = "auto" : arrowElement.style.marginLeft = "auto"
                feedBotListItem.childNodes[0].style.display = "flex"
                feedBotListItem.childNodes[0].appendChild(arrowElement)
                feedBotListItem.appendChild(excelSubListFeatures)
                for (let i = 0; i < excelFeaturesListOptions.length; i++) {
                    let excelOption = excelFeaturesListOptions[i];
                    const excelListItem = document.createElement("li");
                    excelListItem.className = "fb-list-item";
                    const textSpan = document.createElement("span");
                    textSpan.textContent = excelOption.text;
                    excelListItem.appendChild(textSpan)
                    excelSubListFeatures.appendChild(excelListItem);
                    switch (excelOption.type) {
                        case Globals.PARTICIPANTS_FROM_ALL_GROUPS_TYPE:
                            excelListItem.addEventListener("click", exportAllGroupsParticipantsToExcel)
                            break;
                        case Globals.PARTICIPANTS_FROM_SELECTED_GROUPS_TYPE:
                            excelListItem.addEventListener("click", getSelectedGroupsParticipants)
                            break;
                        case Globals.CONTACTS_TYPE:
                            excelListItem.addEventListener("click", showContactsModal)
                            break;
                    }
                }
                break;
            case Globals.SETTINGS_TYPE:
                feedBotListItem.addEventListener("click", () => {showSettingsModal()})
                break;
        }
        feedBotIcon.appendChild(feedBotListFeatures);
        GeneralUtils.listFadeIn(feedBotListFeatures, 400)
    }
}

async function showSettingsModal() {
    let settings = await ChromeUtils.sendChromeMessage({action: Globals.GET_HTML_FILE_ACTION, fileName: 'settings'})
    const settingsHtml = document.createElement('div');
    settingsHtml.innerHTML = settings;
    settingsHtml.querySelector('.fb-header').innerHTML = translation.language;
    let specLanguages = settingsHtml.getElementsByClassName('spec-lang-container');
    for (let element of specLanguages){
        let inputValue = element.getElementsByTagName('input')[0].value.toString();
        let label = element.getElementsByTagName('label')[0];
        switch (inputValue){
            case Globals.HEBREW_LANGUAGE_PARAM:
                label.innerHTML = GeneralUtils.capitalizeFirstLetter(translation.hebrew);
                break;
            case Globals.ENGLISH_LANGUAGE_PARAM:
                label.innerHTML = GeneralUtils.capitalizeFirstLetter(translation.english);
                break;
        }
    }
    let drawerPosition = client.language === Globals.HEBREW_LANGUAGE_PARAM ? 'top-start' : 'top-end'
    let fadeInDirection = client.language === Globals.HEBREW_LANGUAGE_PARAM ? 'fadeInRight' : 'fadeInLeft'
    let fadeOutDirection = client.language === Globals.HEBREW_LANGUAGE_PARAM ? 'fadeOutRight' : 'fadeOutLeft'
    await Swal.fire({
        title: translation.settings,
        html: settingsHtml,
        position: drawerPosition,
        showClass: {popup: `animate__animated animate__${fadeInDirection} animate__faster`},
        hideClass: {popup: `animate__animated animate__${fadeOutDirection} animate__faster`},
        grow: 'column',
        width: 300,
        showConfirmButton: true,
        showCloseButton: true
    }).then(res => {

    })
}

function createSvgElement(data) {
    let element = GenericSvgElement.cloneNode(true)
    element.setAttribute('data-testid', data.data_testid);
    element.setAttribute('data-icon', data.data_icon);
    element.childNodes[0].setAttribute('height', data.height)
    element.childNodes[0].setAttribute('width', data.width)
    element.childNodes[0].childNodes[0].setAttribute('d', data.d)
    return element;
}


async function getSelectedGroupsParticipants() {
    let modelStorageDB = await GeneralUtils.getDB("model-storage")
    await GeneralUtils.getObjectStoresByKeyFromDB(modelStorageDB, 'group-metadata').then((response) => {
        const result = response.result;
        const filteredResult = result.filter(item => item.a_v_id != null);
        const groupsData = filteredResult.map(item => ({groupName: item.subject, groupId: item.id}));
        showGroupsModal(groupsData)
    })

}


async function exportContactsToExcel(selectedOption) {
    let headers;
    switch (selectedOption) {
        case Globals.SAVED_PARAM :
            const savedContacts = contacts.filter(item => {
                return item.isAddressBookContact === 1;
            }).map(item => {
                const phoneNumber = item.id.split('@')[0];
                const phoneBookContactName = item.name || '';
                const whatsappUserName = item.pushname || '';
                return {phoneNumber, phoneBookContactName, whatsappUserName}
            })
            headers = [translation.phoneNumber, translation.contactName, translation.whatsappUsername]
            ExcelUtils.exportToExcelFile(savedContacts, translation.savedContacts, headers)
            break;
        case Globals.UN_SAVED_PARAM:
            const unSavedContacts = contacts.filter(item => {
                return item.isAddressBookContact === 0
            }).map(item => {
                const phoneNumber = item.id.split('@')[0];
                const pushName = item.pushname || ''
                return {phoneNumber, pushName}
            })
            headers = [translation.phoneNumber, translation.contactName]
            ExcelUtils.exportToExcelFile(unSavedContacts, translation.unSavedContacts, headers)
            break;
        case Globals.ALL_PARAM:
            const both = contacts.map(item => {
                const phoneNumber = item.id.split('@')[0];
                const phoneBookContactName = item.name || '';
                const whatsappUserName = item.pushname || '';
                return {phoneNumber, phoneBookContactName, whatsappUserName}
            })
            headers = [translation.phoneNumber, translation.contactName, translation.whatsappUsername]
            ExcelUtils.exportToExcelFile(both, translation.savedAndUnSavedContacts, headers)
            break;
    }

}


async function exportParticipantsByGroupIdsToExcel(groupsId) {
    let modelStorageDB = await GeneralUtils.getDB("model-storage")
    let items = await GeneralUtils.getAllParticipantsFromIndexDB(modelStorageDB)
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
    let modelStorageDB = await GeneralUtils.getDB("model-storage")
    await GeneralUtils.getAllObjectStoreByIndexFromDb(modelStorageDB, 'contact', 'isAddressBookContact').then((response) => {
        const result = response.result;
        newArray = phones.map(phone => {
            const item = result.find(item => item.id.toString().split('@')[0] === phone);
            let name = '';
            if (item) {
                name = item.isAddressBookContact === 1 ? item.name : item.pushname || ''
            }
            return {phone, name}
        });
    })
    return newArray;
}


async function exportAllGroupsParticipantsToExcel() {
    let modelStorageDB = await GeneralUtils.getDB("model-storage")
    let items = await GeneralUtils.getAllParticipantsFromIndexDB(modelStorageDB)
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
    let schedulerListContainer = document.getElementsByClassName('scheduler-messages-container')[0];
    if (schedulerListContainer) {
        let messagesList = schedulerListContainer.querySelector('.messages-list')
        if (messagesList) {
            messagesList.remove()
        }
        setTimeout(async () => {
            let newMessagesList = await createMessagesList();
            schedulerListContainer.appendChild(newMessagesList);
        }, 50)
    }


}

function showSendByPhoneNumberModal() {
    Swal.fire({
        title: translation.sendingByPhoneNumber,
        input: "text",
        inputAutoTrim: true,
        inputPlaceholder: translation.phoneNumber,
        inputAttributes: {
            id: 'phone-input'
        },
        allowOutsideClick: false,
        showCancelButton: true,
        showCloseButton: true,
        reverseButtons: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        cancelButtonText: translation.confirmCancel,
        confirmButtonText: translation.approve,
        preConfirm(inputValue) {
            let phoneNumber = GeneralUtils.removeNonDigits(inputValue).toString()
            if (phoneNumber.length >= Globals.MINIMUM_PHONE_NUMBER_LENGTH_REQUIRES) {
                return phoneNumber;
            } else {
                Swal.showValidationMessage(GeneralUtils.convertToTitle(translation.invalidPhoneNumber))
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            let phoneNumber = result.value.toString();
            if (phoneNumber.startsWith('0')) {
                phoneNumber = GeneralUtils.removeLeadingZeros(phoneNumber)
            }
            enterToChat(phoneNumber)
        }
    });
}

function enterToChat(phoneNumber) {
    const element = document.createElement("a");
    element.href = `${Globals.WHATSAPP_URL}/send?phone=${phoneNumber}`
    element.id = "mychat";
    document.body.append(element);
    let p1 = document.getElementById("mychat");
    p1.click();
    p1.remove();
}

async function showScheduledMessages() {
    let schedulerMessagesExist = document.getElementsByClassName('scheduler-messages-container')[0]
    if (!schedulerMessagesExist) {
        const paneSideElement = document.querySelector(WhatsAppGlobals.sideElement)
        const schedulerListContainer = document.createElement("div");
        schedulerListContainer.className = "scheduler-messages-container";
        const backToChatList = document.createElement('div')
        backToChatList.className = "back-to-chat-list";
        backToChatList.innerText = translation.backToChat
        backToChatList.addEventListener('click', () => {
            schedulerListContainer.remove()
            paneSideElement.style.display = "flex";
        })
        const messagesList = await createMessagesList()
        schedulerListContainer.appendChild(backToChatList)
        schedulerListContainer.appendChild(messagesList);
        paneSideElement.insertAdjacentElement('afterend', schedulerListContainer)
        paneSideElement.style.display = "none"
    }
}

async function createMessagesList() {
    const messagesList = document.createElement("div");
    messagesList.className = "messages-list";
    GeneralUtils.addScrollingAbility(messagesList, `${messagesListHeight}px`)
    const schedulerMessages = await ChromeUtils.getSchedulerMessages();
    const relevantMessages = schedulerMessages.filter(item => (!item.messageSent) && (!item.deleted))
    if (relevantMessages.length > 0) {
        createMessagesFrames(messagesList, relevantMessages).then(r => {
        })
    } else {
        emptyMessagesAlert = document.createElement('div');
        emptyMessagesAlert.className = "empty-scheduler-messages";
        emptyMessagesAlert.innerHTML = translation.arentScheduledMessages
        messagesList.appendChild(emptyMessagesAlert)
    }
    return messagesList;
}

async function createMessagesFrames(messagesList, relevantMessages) {
    for (let i = 0; i < relevantMessages.length; i++) {
        const item = relevantMessages[i];
        const messageFrame = await createMessageFrame(item);
        if (i > 0) {
            messageFrame.style.marginTop = '3px';
        }
        messagesList.appendChild(messageFrame);
    }
}


async function createMessageFrame(item) {
    const newCellFrame = document.createElement('div');
    newCellFrame.innerHTML = cellFrame
    let contactImgElement = newCellFrame.querySelector('.fb-img-inner-ring')
    if (item.imageUrl) {
        contactImgElement.src = item.imageUrl
    }
    let contactNameElement = newCellFrame.querySelector('.fb-cell-content')
    contactNameElement.innerText = item.chatName
    contactNameElement.title = item.chatName
    let extraDetailsElement = newCellFrame.querySelector('.fb-cell-extra-details')
    extraDetailsElement.textContent = item.dateTimeStr
    let messageTextElement = newCellFrame.querySelector('.fb-message-text');
    const text = item.message;
    const maxLength = 30;
    if (text.length > maxLength) {
        messageTextElement.textContent = text.slice(0, maxLength) + '...';
    } else {
        messageTextElement.textContent = text;
    }
    const deleteMessageButton = newCellFrame.querySelector('.fb-custom-cancel-button')
    deleteMessageButton.textContent = translation.deleteText
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
                clearSpecificItem(item.id)
                refreshScheduledMessagesList()
                showToastMessage('bottom-end', 5 * Globals.SECOND, true, translation.messageDeletedSuccessfully, 'success')
            }

        })
    })
    const editMessageButton = newCellFrame.querySelector('.fb-custom-edit-button')
    editMessageButton.textContent = translation.edit
    editMessageButton.addEventListener('click', async () => {
        await showSchedulerModal({type: Globals.EDIT_MESSAGE, itemId: item.id})
    })
    return newCellFrame;
}


function addSchedulerButton() {
    const composeBoxElement = document.querySelector(WhatsAppGlobals.composeBoxElement)
    const clockIconExist = document.querySelector('#clock-icon')
    if (composeBoxElement && !clockIconExist) {
        const clockIcon = new Image();
        clockIcon.id = "clock-icon"
        clockIcon.title = translation.scheduleMessage;
        clockIcon.src = clockSvg;
        composeBoxElement.childNodes[1].childNodes[0].childNodes[1].appendChild(clockIcon)
        clockIcon.addEventListener('click', async () => {
            clockIcon.disabled = true
            await showSchedulerModal({type: Globals.NEW_MESSAGE})
        });
    }
}


async function handleConfirmButtonClick(itemData) {
    if (itemData.messageType === Globals.NEW_MESSAGE) {
        ChromeUtils.getSchedulerMessages().then((schedulerMessages) => {
            const id = schedulerMessages.length === 0 ? 0 : schedulerMessages.length;
            saveMessage(id, itemData.messageText, itemData.scheduledTime, itemData.dateTimeStr).then((result) => {
                refreshScheduledMessagesList()
                let position = client.language === Globals.HEBREW_LANGUAGE_PARAM ? 'bottom-end' : 'bottom-start'
                showToastMessage(position, 2 * Globals.SECOND, false, translation.messageSavedSuccessfully, 'success')
            }).catch((error) => {
                console.log(error, "save message")
            })
        }).catch((onerror) => {
            console.log(onerror.message, "get scheduler messages")
        })
    }
    if (itemData.messageType === Globals.EDIT_MESSAGE) {
        ChromeUtils.getScheduleMessageById(itemData.itemId).then(result => {
            let updatedItem = result;
            updatedItem.message = itemData.messageText;
            updatedItem.scheduledTime = itemData.scheduledTime;
            updatedItem.dateTimeStr = itemData.dateTimeStr;
            ChromeUtils.updateItem(updatedItem).then(r => {
                initMessagesTimeOut()
                refreshScheduledMessagesList()
            })
        })
    }
}

async function showBulkState() {
    try {
        let bulkState = await ChromeUtils.sendChromeMessage({action: 'get-html-file', fileName: 'bulkstate'})
        let bulkStateHtml = document.createElement('div');
        bulkStateHtml.className = "bulk-state-container"
        bulkStateHtml.innerHTML = bulkState;
        document.body.appendChild(bulkStateHtml)
    } catch (e) {

    }

}

function clearBulkState() {
    let bulkStateHtml = document.getElementsByClassName('bulk-state-container')[0]
    if (bulkStateHtml) {
        bulkStateHtml.remove()
    }
}

const startBulkSending = async (data) => {
    await updateClientState(Globals.SENDING_STATE, Globals.BULK_SENDING)
    await showBulkState()
    let bulkSendingData = data.bulkSendingData;
    let index = data.startIndex;
    let extra = data.extra
    const sendNextItem = () => {
        if (index >= bulkSendingData.length) {
            clearBulkState();
            return;
        }
        const item = bulkSendingData[index]
        executeContactSending(item).then((result) => {
            index++;
            sendNextItem()
        }).catch(reason => {
            index++;
            sendNextItem()
        })

    }
    sendNextItem()
}

const sendScheduledMessage = async (id) => {
    const item = await ChromeUtils.getScheduleMessageById(id);
    await updateClientState(Globals.UNUSED_STATE, Globals.SCHEDULED_SENDING)
    let relevantMessage = (new Date().getTime() - item.scheduledTime) <= 5 * Globals.MINUTE;
    if ((relevantMessage || item.repeatSending) && (!item.messageSent && !item.deleted)) {
        if (client.state === Globals.SENDING_STATE) {
            const sendingInterval = setInterval(() => {
                if (client.state === Globals.UNUSED_STATE) {
                    clearInterval(sendingInterval)
                    sendScheduledMessage(id)
                }
            }, 100)
        } else {
            await updateClientState(Globals.SENDING_STATE, Globals.SCHEDULED_SENDING)
            if (item.chatType === Globals.CONTACT_PARAM) {
                executeContactSending(item).then(async res => {
                    await updateClientState(Globals.UNUSED_STATE, '')
                    if (res.success) {
                        item.messageSent = true;
                        await ChromeUtils.updateItem(item);
                        refreshScheduledMessagesList()
                    }
                })
            }

        }
    } else {
        if (!item.deleted && !item.messageSent) {
            item.repeatSending = true;
            await ChromeUtils.updateItem(item);
            unSentMessagesIds.push(...unSentMessagesIds, item.id)
        }
    }
}

function executeContactSending(item) {
    let error = null, success = false;
    return new Promise(async (resolve, reject) => {
        const element = document.createElement("a");
        element.href = `${Globals.WHATSAPP_URL}/send?phone=${item.media}&text=${item.message}`;
        element.id = "mychat";
        document.body.append(element);
        let p1 = document.getElementById("mychat");
        p1.click();
        let tries = 0;
        const waitForChatInterval = setInterval(async () => {
            if (tries > 40) {
                const popup = document.querySelector('div[data-testid="confirm-popup"]');
                p1.remove();
                error = popup ? Errors.INVALID_PHONE : Errors.GENERAL_ERROR
                clearInterval(waitForChatInterval);
                resolve({success, error});
            } else {
                const chatDetails = await GeneralUtils.getChatDetails();
                if (chatDetails.chatId === item.chatId || chatDetails.chatId.includes(item.chatId)) {
                    clearInterval(waitForChatInterval);
                    const waitForTextInterval = setInterval(async () => {
                        const composeBoxElement = document.querySelector(WhatsAppGlobals.composeBoxElement);
                        if (composeBoxElement) {
                            let textInput = document.querySelectorAll('[class*="text-input"]')[1];
                            if (textInput.textContent === item.message) {
                                clearInterval(waitForTextInterval);
                                try {
                                    await GeneralUtils.waitForNodeWithTimeOut(document.body, 'span[data-testid="send"]', Globals.SECOND * 5).then(sendElement => {
                                        sendElement.click();
                                        p1.remove();
                                        success = true;
                                        resolve({success, error});
                                    })
                                } catch (currentError) {
                                    error = Errors.ELEMENT_NOT_FOUND
                                    reject({success, error});
                                }
                            } else {
                                let chatBody = document.querySelector(WhatsAppGlobals.conversationBodyElement);
                                if (chatBody) {
                                    chatBody.click();
                                }
                                GeneralUtils.simulateKeyPress('keydown', "Escape");
                                await GeneralUtils.sleep(1);
                                p1.click();
                            }
                        }
                    }, 200);
                }
            }
            tries++;
        }, 200);
    });
}


async function searchingForGroup(media) {
    let side = document.getElementById('pane-side')
    side.scrollTop -= side.scrollTop /// scroll to top
}


async function saveMessage(id, message, scheduledTime, dateTimeStr) {
    return new Promise(async (resolve, reject) => {
        try {
            let currentChatDetails = await GeneralUtils.getChatDetails()
            const conversationHeaderElement = document.querySelector(WhatsAppGlobals.conversationHeaderElement);
            const foundItem = contacts.find(item => {
                let itemPhone = item.id.split('@')[0]
                return currentChatDetails.chatId.includes(itemPhone)
            })
            let chatName;
            if (foundItem) {
                chatName = foundItem.name
            } else {
                chatName = "+" + currentChatDetails.media
            }
            const imageUrl = conversationHeaderElement.childNodes[0].childNodes[0].childNodes[0].src || defaultUserImage
            const elapsedTime = scheduledTime - new Date().getTime();
            const userInteractWarning = elapsedTime > Globals.USER_INTERACT_WARNING_TIME * Globals.SECOND
            const data = {
                id,
                message,
                scheduledTime,
                chatId: currentChatDetails.chatId,
                chatType: currentChatDetails.chatType,
                media: currentChatDetails.media,
                sendingType: Globals.SCHEDULED_SENDING,
                imageUrl,
                chatName,
                dateTimeStr,
                userInteractWarning,
                repeatSending: false,
                messageSent: false,
                deleted: false,
            };
            const currentSchedulerMessages = await ChromeUtils.getSchedulerMessages();
            const updatedSchedulerMessages = [...currentSchedulerMessages, data];
            await ChromeUtils.updateSchedulerMessages(updatedSchedulerMessages)
            await setTimeOutForMessage(id, chatName, elapsedTime, userInteractWarning);
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

async function checkForUserInteraction(seconds) {
    let userIsInteracting = false;
    let initialTexts = await getAllTexts().then((result) => result.sort());
    return new Promise((resolve) => {
        const interactionCheckingInterval = setInterval(() => {
            seconds--;
            if (seconds <= 0 || userIsInteracting) {
                clearInterval(interactionCheckingInterval);
                removeClickListener();
                resolve(userIsInteracting);
            } else {
                getAllTexts().then((currentTexts) => {
                    let areTextsEqual = GeneralUtils.areArrayEqual(
                        currentTexts.sort(),
                        initialTexts
                    );
                    if (!areTextsEqual) {
                        userIsInteracting = true;
                    }
                });
            }
        }, Globals.SECOND);

        const clickListener = () => {
            userIsInteracting = true;
        };

        const removeClickListener = () => {
            document.removeEventListener("click", clickListener);
        };

        // Listen for click events on the WhatsApp Web page
        document.addEventListener("click", clickListener);
    });

    function getAllTexts() {
        return new Promise((resolve) => {
            const texts = [];
            const inputs = document.querySelectorAll('[class*="text-input"]');
            inputs.forEach((input) => {
                texts.push(input.textContent);
            });
            resolve(texts);
        });
    }
}




function setTimeOutForMessage(id, chatName, elapsedTime, userInteractWarning) {
    if (userInteractWarning) {
        activeMessagesTimeout[id] = setTimeout(async () => {
            let isUserInteract = await checkForUserInteraction(Globals.USER_INTERACT_WARNING_TIME)
            if (isUserInteract) {
                let title = `${translation.scheduledMessageTo} ${chatName}`
                let html = `${translation.messageWillBeSent} <b></b> ${translation.seconds}`
                showAlertWithTimeOut(Globals.USER_INTERACT_WARNING_TIME * Globals.SECOND, title, html)
                await GeneralUtils.sleep(Globals.USER_INTERACT_WARNING_TIME)
            }
            sendScheduledMessage(id).then(res => {
                delete activeMessagesTimeout[id]
            })
        }, elapsedTime - (Globals.USER_INTERACT_WARNING_TIME * Globals.SECOND))
    } else {
        activeMessagesTimeout[id] = setTimeout(() => {
            sendScheduledMessage(id).then(res => {
                delete activeMessagesTimeout[id]
            })
        }, elapsedTime)
    }

}


function showAlertWithTimeOut(timer, title , html) {
    let timerInterval
    Swal.fire({
        title: title,
        html: html ,
        timer: timer,
        timerProgressBar: false,
        didOpen: () => {
            //Swal.showLoading()
            const b = Swal.getHtmlContainer().querySelector('b')
            timerInterval = setInterval(() => {
                b.textContent = Math.ceil(Swal.getTimerLeft() / Globals.SECOND).toString()
            }, Globals.SECOND)
        },
        willClose: () => {
            clearInterval(timerInterval)
        }
    }).then((result) => {
        if (Swal.DismissReason.timer) {
            //console.log('I was closed by the timer')
        }
    })
}

const showErrorModal = (message) => {
    Swal.fire({
        icon: 'error',
        title: translation.oops,
        text: message,
    }).then()
}


const showUnSentMessagesModal = (unSentMessages) => {
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
        divItem.innerText = `${index + 1}) ${item.chatName} (${item.message})`
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
    }).then(async (result) => {
        if (result.isConfirmed) {
            await GeneralUtils.sleep(1);
            for (const item of unSentMessages) {
                item.repeatSending = true;
                await ChromeUtils.updateItem(item);
                await sendScheduledMessage(item.id)
            }
        }
        if (result.isDismissed || result.dismiss) {
            unSentMessages.forEach(item => {
                item.deleted = true;
                ChromeUtils.updateItem(item).then(r => {
                })
            })
        }
    });
}


const showBulkSendingModal = async () => {
    let excelData;
    let excelHeaders;
    let state = {message: '', csvFile: false}
    try {
        const bulkSendingModalHTML = await ChromeUtils.sendChromeMessage({
            action: Globals.GET_HTML_FILE_ACTION,
            fileName: 'bulksendmodal'
        });
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
                let bulkSendingData = excelData.map((item, index) => {
                    return {
                        id: index,
                        media: item.colA,
                        message: state.message,
                        messageSent: false,
                        sendingType: Globals.BULK_SENDING,
                        chatId: item.colA + '@c.us'
                    }
                })
                let extra = {pauseBetweenMessages: Globals.SECOND * 10}
                startBulkSending({bulkSendingData:bulkSendingData ,dataSource: Globals.EXCEL_PARAM, extra, startIndex: 0})
            }
        });
        let body = document.getElementsByClassName('bulk-sending-modal-container')[0];
        const confirmButton = Swal.getConfirmButton();
        confirmButton.disabled = true;
        const updateConfirmButton = () => {
            confirmButton.disabled = !(state.csvFile && state.message.length > 0);
        };
        const messageTextArea = document.getElementById('message')
        messageTextArea.placeholder = translation.typeMessage;
        messageTextArea.addEventListener('input', () => {
            state.message = messageTextArea.value
            updateConfirmButton()
        })
        const fileInput = document.getElementById('excel-file');
        const deleteButton = document.getElementById('delete-file-button');
        deleteButton.innerText = translation.deleteFile
        deleteButton.style.width = "8em";
        deleteButton.style.height = "2em"
        deleteButton.addEventListener('click', () => {
            fileInput.value = ''; // Clear the file input value
            deleteButton.style.display = 'none'; // Hide the delete button
            resetData()
        });
        fileInput.addEventListener('change', async () => {
            const selectedFile = fileInput.files[0];
            if (selectedFile) {
                deleteButton.style.display = 'inline-block';
            }
            const fileName = selectedFile.name;
            const fileSuffix = fileName.split('.').pop().toLowerCase();
            if (fileSuffix === 'csv') {
                Swal.resetValidationMessage()
                state.csvFile = true;
                let phoneSelector = document.getElementById('phone-format');
                let formatType = phoneSelector.value;
                ExcelUtils.readExcelFile(selectedFile, formatType).then((result) => {
                    excelData = result.data;
                    excelHeaders = result.headers
                    let tableContainer = document.createElement('div');
                    tableContainer.className = "fb-table-container";
                    if (client.language === Globals.HEBREW_LANGUAGE_PARAM) {
                        tableContainer.style.direction = "ltr"
                    }
                    let bulkTable = GeneralUtils.createTable(excelHeaders, excelData)
                    tableContainer.appendChild(bulkTable)
                    body.appendChild(tableContainer)
                })
            } else {
                resetData()
                Swal.showValidationMessage(translation.fileMustToBeCSV);

            }
            updateConfirmButton();
        });

        function resetData() {
            Swal.resetValidationMessage()
            state.csvFile = false;
            let tableBody = document.getElementsByClassName('fb-table-container')[0]
            if (tableBody) {
                tableBody.remove()
            }
            updateConfirmButton()
        }

        const availableFormatters = [
            {value: Globals.NO_VALUE_PARAM, text: translation.noValue}
            , {value: Globals.ISRAEL_PARAM, text: translation.israel}
            , {value: Globals.USA_PARAM, text: translation.usa}]
        const formatSelector = document.getElementById('phone-format')
        for (let formatter of availableFormatters) {
            let option = document.createElement('option')
            option.value = formatter.value;
            option.text = formatter.text
            formatSelector.appendChild(option)
        }
    } catch (error) {
        console.error(error);
    }

}


const showSchedulerModal = async (data) => {
    let state = {success: false, errorCode: null, scheduledTime: null, messageText: '', dateTimeStr: null}
    const container = document.createElement("div");
    container.className = "scheduler-modal-container";
    const messageTextArea = document.createElement("textarea");
    messageTextArea.id = "message"
    messageTextArea.className = "fb-textarea";
    messageTextArea.placeholder = translation.messageContent
    const datetimeContainer = document.createElement('div');
    datetimeContainer.className = "date-container";
    datetimeContainer.style.direction = client.language === Globals.HEBREW_LANGUAGE_PARAM ? "rtl" : "ltr"
    const dateTimeLabel = document.createElement('label');
    dateTimeLabel.className = "fb-label";
    dateTimeLabel.style.display = "flex"
    dateTimeLabel.textContent = translation.chooseScheduleTime
    const datetimeInput = document.createElement('input');
    datetimeInput.type = "datetime-local";
    datetimeInput.id = "datetimeInput";
    datetimeInput.className = "fb-date-picker"
    datetimeContainer.appendChild(dateTimeLabel)
    datetimeContainer.appendChild(datetimeInput)
    if (data.type === Globals.NEW_MESSAGE) {
        datetimeInput.value = GeneralUtils.getFullDateAsString(new Date())
        let textInput = document.querySelectorAll('[class*="text-input"]')[1];
        if (textInput.textContent !== WAInputPlaceholder) {
            messageTextArea.value = textInput.textContent
        }
    }
    if (data.type === Globals.EDIT_MESSAGE) {
        const item = await ChromeUtils.getScheduleMessageById(data.itemId)
        let date = new Date(item.scheduledTime)
        datetimeInput.value = GeneralUtils.getFullDateAsString(date)
        messageTextArea.value = item.message;
    }
    container.appendChild(messageTextArea)
    container.appendChild(datetimeContainer)
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
        preConfirm: () => {
            state.success = false;
            state.messageText = messageTextArea.value.trim();
            state.scheduledTime = (new Date(datetimeInput.value)).getTime();
            if (state.messageText.length > 0) {
                if (state.scheduledTime > Date.now()) {
                    state.success = true;
                    state.errorCode = null;
                } else {
                    state.errorCode = Errors.INVALID_DATE
                }
            } else {
                state.errorCode = Errors.MISSING_TEXT;
            }
            if (state.success) {
                state.dateTimeStr = datetimeInput.value.replace('T', ' ')
                return true;
            } else {
                let errorMessage = getErrorMessage(state.errorCode)
                Swal.showValidationMessage(errorMessage);
                return false;
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            let itemData = {
                messageType: '',
                messageText: state.messageText,
                dateTimeStr: state.dateTimeStr,
                scheduledTime: state.scheduledTime,
            };
            itemData.messageType = data.type === Globals.NEW_MESSAGE ? Globals.NEW_MESSAGE : Globals.EDIT_MESSAGE;
            if (data.type === Globals.EDIT_MESSAGE) {
                itemData.itemId = data.itemId;
            }
            await handleConfirmButtonClick(itemData)
        }
    })
}
const showGroupsModal = (result) => {
    const container = document.createElement("div");
    container.className = "groups-modal-container";
    const searchBarContainer = document.createElement("div");
    searchBarContainer.classList.add('fb-search-bar-container')
    const searchBar = document.createElement('input');
    searchBar.id = "fb-search-bar"
    searchBar.placeholder = translation.search;
    searchBar.classList.add('fb-search-bar');
    searchBarContainer.appendChild(searchBar)
    container.appendChild(searchBarContainer)
    searchBar.addEventListener('input', handleSearch);
    const groupsBody = document.createElement("div")
    groupsBody.className = "groups-body";
    for (let item of result) {
        let checkBoxContainer = createCheckBoxContainer(item)
        groupsBody.appendChild(checkBoxContainer)
        container.appendChild(groupsBody)
    }

    function createCheckBoxContainer(item) {
        let checkBoxContainer = document.createElement('div')
        checkBoxContainer.className = "checkbox-container";
        checkBoxContainer.id = item.groupId;
        let checkboxInput = document.createElement('input')
        checkboxInput.type = "checkbox"
        checkboxInput.name = item.groupName;
        checkboxInput.value = item.groupId
        checkboxInput.id = item.groupId;
        let checkboxLabel = document.createElement('label')
        checkboxLabel.classList.add('fb-label');
        checkboxLabel.style.display = "flex"
        checkboxLabel.setAttribute('for', item.groupName)
        checkboxLabel.innerText = item.groupName;
        checkboxLabel.setAttribute("for", item.groupId)
        checkBoxContainer.appendChild(checkboxInput)
        checkBoxContainer.appendChild(checkboxLabel)
        return checkBoxContainer;
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
            const checkboxes = groupsBody.querySelectorAll("input[type=checkbox]");
            const checkboxesArray = Array.from(checkboxes);
            const checkedCheckboxes = checkboxesArray.filter(checkbox => checkbox.checked);
            const checkedValues = checkedCheckboxes.map(checkbox => checkbox.value);
            if (checkedValues.length > 0) {
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
            })
        }
    });

    function handleSearch() {
        const searchValue = searchBar.value.toLowerCase();
        GeneralUtils.clearChildesFromParent(groupsBody).then(() => {
            for (let item of result) {
                if (item.groupName.toLowerCase().includes(searchValue)) {
                    let checkBoxContainer = createCheckBoxContainer(item); // Get the checkbox container element by its ID from initialCheckBoxContainer
                    groupsBody.appendChild(checkBoxContainer)
                }
            }
        });
    }


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
        label.style.display = "flex"
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
                return selectedOption;
            } else {
                // Show an error message and prevent modal from closing
                Swal.showValidationMessage(translation.mustToChooseOneOption);
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const selectedOption = result.value;
            exportContactsToExcel(selectedOption).then(r => () => {
                //console.log(selectedOption)
            })
        }
    });
}


const showToastMessage = (position, timer, timerProgressBar, title, iconType) => {
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
        icon: iconType,
        title: title
    })
}


function getErrorMessage(errorCode) {
    let errorMessage;
    switch (errorCode) {
        case Errors.INVALID_PHONE:
            errorMessage = translation.invalidPhoneNotice;
            break;
        case Errors.MISSING_TEXT:
            errorMessage = translation.messageMustContainsText;
            break;
        case Errors.INVALID_DATE:
            errorMessage = translation.invalidDateNotice;
            break;
    }
    return errorMessage
}
