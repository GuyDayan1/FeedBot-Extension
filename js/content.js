import * as ChromeUtils from "./utils/chromeutils";
import * as GeneralUtils from "./utils/generalutils"
import * as Globals from "./utils/globals"
import * as WhatsAppGlobals from './utils/whatsappglobals'
import Swal from "sweetalert2";
import {updateItem} from "./utils/chromeutils";


let headerElement;
let cellFrameElement;
let connected = false;
let schedulerMessagesDisplay = false;
let completeStatusCounter = 0;
let currentChatDetails = {type:"", media:"" , chatId: ""}
let feedBotPopup
let load = false;
let addedDateSelectedOptions = false
let closeSchedulerModal;
let cancelSchedulerModalButton;
let dateInputSchedulerModal
let hourSelectorSchedulerModal;
let minuteSelectorSchedulerModal;
let sendButtonSchedulerModal;
let messageSchedulerModal;
let schedulerModal;
let emptyMessagesAlert;
let modalBackdrop;
let clockIcon;
let client = {state : Globals.UNUSED_STATE , sendingType:""};
let activeMessagesTimeout = {};





chrome.runtime.onMessage.addListener((message, sender, response) => {
    if (message === "complete") {
        completeStatusCounter++;
        if ((completeStatusCounter > 1) && (!load)) {
            loadElements().then(() => console.log("Finish to load elements!"))
        }
    }
});



const loadElements = async () => {
    await addFeedBotIcon();
    await addModalToDOM();
    await initMessagesTimeOut();
    await addSchedulerListToDOM();
    await checkForChatElementListener();
    load = true;
};

async function initMessagesTimeOut() {
    waitForNode(document.body , WhatsAppGlobals.paneSideElement).then(async () => {
        if (Object.keys(activeMessagesTimeout.length === 0)) {await clearAllItemsTimeOuts();}
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

const showSentMessagesPopup = (unSentMessages) => {
    const container = document.createElement("div");
    container.className = "un-sent-container";
    const headline = document.createElement("div");
    headline.innerText = "ההודעות הבאות לא נשלחות האם את/ה מעוניינ/ת לשלוח את ההודעות?";
    headline.style.fontWeight = "600";
    headline.style.fontSize = "0.8em"
    container.appendChild(headline);
    unSentMessages.forEach((item,index)=> {
        let divItem = document.createElement('div')
        divItem.className = "un-sent-message";
        divItem.innerText = `${index+1}) ${item.chatTitleElement.chatName} (${item.message})`
        divItem.style.width = "max-content"
        divItem.style.marginTop = "8px"
        container.appendChild(divItem)
    })
    Swal.fire({
        title: 'הודעות מתוזמנות',
        html: container,
        icon: 'info',
        reverseButtons: true,
        showCancelButton: true,
        confirmButtonText: 'כן,שלח',
        cancelButtonText : 'ביטול'
    }).then((result) => {
        if (result.isConfirmed) {
            unSentMessages.forEach(item=>{
                sendMessage(item.id).then()
            })
        }
        if (result.isDismissed){
            unSentMessages.forEach(item=>{
                item.deleted = true;
                ChromeUtils.updateItem(item).then(r => {})
            })
        }
    });

}
async function clearAllItemsTimeOuts() {
    for (let id in activeMessagesTimeout) {
        clearTimeout(activeMessagesTimeout[id]);
        console.log("cleared,  id: " + id +" timeoutId " + activeMessagesTimeout[id])
    }
    activeMessagesTimeout = {}
    console.log("active messages timeouts:")
    console.log(activeMessagesTimeout)
}

function clearTimeOutItem(id) {
    clearTimeout(activeMessagesTimeout[id])
    delete activeMessagesTimeout[id]
    console.log("active messages timeouts:")
    console.log(activeMessagesTimeout)

}


function addFeedBotIcon() {
    const headerElementObserver = new MutationObserver(async () => {
        headerElement = document.querySelector(WhatsAppGlobals.chatListHeaderElement);
        if (headerElement !== null) {
            connected = true;
            headerElementObserver.disconnect();
            let secondDiv = headerElement.childNodes[1];
            let childNodes = secondDiv.childNodes;
            const firstChild = childNodes[0].firstChild;
            const feedBotDivExists = document.getElementsByClassName("feedBot-icon")[0]
            if (!feedBotDivExists) {
                const feedBotIcon = document.createElement("div");
                feedBotIcon.style.backgroundImage = `url(${chrome.runtime.getURL("images/feedBot-icon.png")})`;
                feedBotIcon.className = "feedBot-icon";
                feedBotIcon.title = "FeedBot";
                childNodes[0].insertBefore(feedBotIcon, firstChild);
                feedBotPopup = document.createElement("div");
                feedBotPopup.className = "feedBot-popup";
                feedBotIcon.appendChild(feedBotPopup);
                feedBotIcon.addEventListener("click", () => {
                    let currentDisplayState = feedBotPopup.style.display
                    if (currentDisplayState == "block") {
                        feedBotPopup.style.display = "none"
                    } else {
                        feedBotPopup.style.display = "block"
                    }
                });
                window.addEventListener("click", (event) => {
                    if (!feedBotPopup.contains(event.target) && !feedBotIcon.contains(event.target)) {
                        feedBotPopup.style.display = "none"
                    }
                });
                addFeedBotOptionList();
            }
            cellFrameElement = document.querySelector(WhatsAppGlobals.cellFrameElement);
            Globals.CLIENT_LANGUAGE = localStorage.getItem(WhatsAppGlobals.WA_language).replaceAll('"','');
            if (Globals.CLIENT_LANGUAGE.includes(Globals.HEBREW_IDENTIFIER_PARAM)){
                Globals.DEFAULT_WHATSAPP_CHAT_PLACEHOLDER = "הקלדת ההודעה"
            }
            if (Globals.CLIENT_LANGUAGE.includes(Globals.ENGLISH_IDENTIFIER_PARAM)){
                Globals.DEFAULT_WHATSAPP_CHAT_PLACEHOLDER = "Type a message"
            }
            //ChromeUtils.clearStorage()
        }

    });
    headerElementObserver.observe(document.body, {childList: true, subtree: true});
}

function addModalToDOM() {
    let modal = document.querySelector(Globals.schedulerModalElement)
    if (!modal) {
        let htmlUrl = chrome.runtime.getURL("html/modal.html");
        fetch(htmlUrl)
            .then(response => response.text())
            .then(html => {
                let modalContainer = document.createElement("div");
                modalContainer.innerHTML = html;
                document.body.appendChild(modalContainer);
            });
    }
    waitForNode(document.body, Globals.schedulerModalElement).then((modal) => {
        schedulerModal = modal;
        dateInputSchedulerModal = schedulerModal.querySelector('#datepicker')
        closeSchedulerModal = schedulerModal.querySelector("#close-modal");
        cancelSchedulerModalButton = schedulerModal.querySelector("#cancel-modal-button");
        hourSelectorSchedulerModal = schedulerModal.querySelector("#hour");
        minuteSelectorSchedulerModal = schedulerModal.querySelector("#minute");
        sendButtonSchedulerModal = schedulerModal.querySelector("#send-button");
        messageSchedulerModal = schedulerModal.querySelector('#message')
        if (!addedDateSelectedOptions) {
            addSelectOptions(hourSelectorSchedulerModal, "hour")
            addSelectOptions(minuteSelectorSchedulerModal, "minute")
        }
        closeSchedulerModal.addEventListener('click', () => {clearSchedulerModal();})
        cancelSchedulerModalButton.addEventListener('click', () => {clearSchedulerModal()})
        sendButtonSchedulerModal.addEventListener("click", async () => {
            await handleSendButtonClick({type:Globals.NEW_MESSAGE})
        });

    })

    /// background for popups
    modalBackdrop = document.createElement('div');
    modalBackdrop.className = "modal-backdrop";
    document.body.appendChild(modalBackdrop)
}

function clearSchedulerModal() {
    schedulerModal.style.display = "none";
    modalBackdrop.style.display = "none"
    messageSchedulerModal.value = '';
}

function addSchedulerListToDOM() {
    const schedulerListContainer = document.createElement("div");
    schedulerListContainer.className = "scheduler-messages-container";

    const backToChatList = document.createElement('div')
    backToChatList.className = "back-to-chat-list";
    backToChatList.innerText = "לחץ חזרה לצ'אטים"


    const messagesList = document.createElement("div");
    messagesList.className = "messages-list";

    messagesList.addEventListener('scroll', function() {
        const isOverflowing = messagesList.scrollHeight > messagesList.clientHeight;
        if (isOverflowing) {
            messagesList.style.overflowY = 'scroll';
        } else {
            messagesList.style.overflowY = 'auto';
        }
    });
    backToChatList.addEventListener('click', () => {
        const paneSideElement = document.querySelector(WhatsAppGlobals.paneSideElement);
        schedulerListContainer.style.display = "none";
        paneSideElement.style.display = "block";
        schedulerMessagesDisplay = false;
    })

    schedulerListContainer.appendChild(backToChatList)
    schedulerListContainer.appendChild(messagesList);


    waitForNode(document.body, WhatsAppGlobals.paneSideElement).then((element) => {
        element.insertAdjacentElement('afterend', schedulerListContainer)
    })

}


function addFeedBotOptionList() {
    const feedBotList = document.createElement("ul");
    feedBotList.className = "feedBot-list";
    for (let i = 0; i < Globals.FEEDBOT_LIST_OPTIONS.length; i++) {
        const listItem = document.createElement("li");
        listItem.textContent = Globals.FEEDBOT_LIST_OPTIONS[i];
        feedBotList.appendChild(listItem);
        switch (Globals.FEEDBOT_LIST_OPTIONS[i]) {
            case Globals.SCHEDULED_MESSAGES_PARAM:
                listItem.addEventListener("click", showScheduledMessages)
                break;
            case "הגדרות":
                listItem.addEventListener("click", openSettings);
                break;
            case Globals.EXTRACT_GROUP_PARTICIPANTS_TO_EXCEL_PARAM:
                listItem.addEventListener("click" , getAllGroupsParticipant)
                break;
        }
    }
    feedBotPopup.appendChild(feedBotList);
}


async function getAllGroupsParticipant() {
    let phones;
    const modelStorageDB = await getDB("model-storage")
    const IDBRequest = await getObjectStoresByKeyFromDB(modelStorageDB , 'participant').then((response)=>{
        const groupParticipants = response.result;
        const participants = groupParticipants.map(item => {
            if (item.participants.length > 0 || true){
                return item.participants;
            }
        }).flat();
        const uniqueParticipants = [...new Set(participants)]
        phones = uniqueParticipants.map(chatId=> {
          return chatId.split('@')[0]
        })
        console.log(phones)

    })
    // const IDBRequest1 = await getObjectStoresByKeyFromDB(modelStorageDB , 'group-metadata').then((response)=>{
    //     console.log(response)
    // })
    // const IDBRequest2 = await getObjectStoresByKeyFromDB(modelStorageDB , 'contact').then((response)=>{
    //     console.log(response)
    // })
}

function getDB(dbName) {
    return new Promise((resolve => {
        let db;
        const request = indexedDB.open(dbName);
        request.onerror = (event) => {
            console.error("Why didn't you allow my web app to use IndexedDB?!");
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db)
        };
    }))
}

function getObjectStoresByKeyFromDB(db , key) {
    return new Promise(((resolve) => {
        let transaction = db.transaction(key, 'readonly')
        let objectStore = transaction.objectStore(key);
        let getAllRequest = objectStore.getAll();
        getAllRequest.onsuccess = ()=>{
            resolve(getAllRequest)
        }
  }))
}



async function showScheduledMessages() {
    if (!schedulerMessagesDisplay) {
        const messagesContainerElement = document.getElementsByClassName("scheduler-messages-container")[0]
        const paneSideElement = document.querySelector(WhatsAppGlobals.paneSideElement)
        const messagesList = document.getElementsByClassName("messages-list")[0];
        paneSideElement.style.display = "none"
        messagesContainerElement.style.display = "block"
        await GeneralUtils.clearChildesFromParent(messagesList)
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
                    deleteMessageButton.addEventListener('click' , (e)=>{
                        Swal.fire({
                            title: 'מחיקת הודעה',
                            text: "האם אתה בטוח שתרצה למחוק הודעה זו?",
                            icon: 'warning',
                            showCancelButton: true,
                            reverseButtons : true,
                            confirmButtonColor: '#3085d6',
                            cancelButtonColor: '#d33',
                            cancelButtonText : "בטל" ,
                            confirmButtonText: 'כן, מחק',
                            customClass: {
                                confirmButton: 'custom-confirm-button-sa',
                                cancelButton: 'custom-cancel-button-sa'
                            }
                        }).then((result) => {
                            if (result.isConfirmed) {
                                item.deleted = true;
                                ChromeUtils.updateItem(item)
                                clearTimeOutItem(item.id)
                                showToastMessage('bottom-end',5*Globals.SECOND,true,"ההודעה נמחקה בהצלחה")
                                // Swal.fire(
                                //     'הודעה נמחקה',
                                //     'ההודעה שתזמנת נמחקה',
                                // )
                            }
                        })
                    })
                    const editMessageButton = document.createElement('button')
                    editMessageButton.textContent = "ערוך"
                    editMessageButton.className = "custom-edit-button"
                    editMessageButton.addEventListener('click' , async () => {
                        await openSchedulerModal()
                        sendButtonSchedulerModal.addEventListener("click", async () => {
                            await handleSendButtonClick({type:Globals.EDIT_MESSAGE , itemId: item.id})
                        });

                        // if (text.toString().trim().length === 0){
                        //     showErrorMessage(Globals.MESSAGE_MISSING_TEXT)
                        // }else {
                        //     showToastMessage('top-end' , true , 5000 , false , "ההודעה נשמרה בהצלחה")
                        // }
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
            emptyMessagesAlert.innerHTML = "אין הודעות מתוזמנות"
            messagesList.appendChild(emptyMessagesAlert)
        }
    }
    schedulerMessagesDisplay = true;
}




function openSettings() {
    console.log("Opening settings");
}


function checkForChatElementListener() {
    waitForNode(document.body, WhatsAppGlobals.paneSideElement).then(r => {
        document.body.addEventListener('click', () => {
            waitForNodeWithTimeOut(document.body, WhatsAppGlobals.conversationHeaderElement, 3000).then(async (element) => {
                currentChatDetails = getChatDetails();
                waitForNodeWithTimeOut(document.body, WhatsAppGlobals.composeBoxElement, 3000)
                    .then((element) => {
                        const clockIcon = document.getElementById("clock-icon");
                        if (!clockIcon){
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




function getChatDetails() {
    let type;
    let media;
    let chatId;
    const element = document.querySelector("[data-testid*='conv-msg']");
    const dataTestId = element.getAttribute("data-testid");
    const parts = dataTestId.split("_");
    chatId = parts[1];
    if (chatId.includes("@g.us")) {
        media = document.querySelector('span[data-testid="conversation-info-header-chat-title"]').textContent;
        type = Globals.GROUP_PARAM
    } else {
        media = chatId.split("@")[0]
        type = Globals.CONTACT_PARAM
    }
    return {type, media, chatId}
}

async function addSchedulerButton() {
    const composeBoxElement = document.querySelector(WhatsAppGlobals.composeBoxElement)
    if (composeBoxElement){
        if (!clockIcon){
            const pttElement = composeBoxElement.childNodes[1].childNodes[0].childNodes[1].childNodes[1];
            clockIcon = pttElement.cloneNode(true)
            clockIcon.id = "clock-icon"
            clockIcon.title = "תזמון הודעה"
            const buttonChild = clockIcon.childNodes[0]
            const spanChild = buttonChild.childNodes[0]
            buttonChild.setAttribute('data-testid', 'scheduler-btn');
            buttonChild.setAttribute('aria-label', 'תזמון הודעה');
            spanChild.setAttribute('data-testid', 'scheduler');
            spanChild.setAttribute('data-icon', 'scheduler');
            if (spanChild.classList.length === 2){
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
        clockIcon.removeEventListener('click', () => {});
        clockIcon.addEventListener('click', () => {
            openSchedulerModal();
            console.log("click on clock")
        });
    }


}



async function handleSendButtonClick(data) {
    let scheduleMessageWarning = {show: false, warningMessage: Globals.MESSAGE_MISSING_TEXT};
    let message = messageSchedulerModal.value.trim();
    console.log(message)
    const date = dateInputSchedulerModal.value;
    const hour = hourSelectorSchedulerModal.value;
    let minute = minuteSelectorSchedulerModal.value;
    if (message.length === 0) {scheduleMessageWarning.show = true;}
    if (minute < 10) {minute = "0" + minute;}
    const dateTimeStr = date + " " + hour + ":" + minute;
    let scheduledTime = (new Date(dateTimeStr)).getTime();
    if (scheduledTime <= Date.now()) {scheduledTime = new Date().getTime()}
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
                let newItem = result;
                newItem.message = message;
                newItem.scheduledTime = scheduledTime;
                newItem.dateTimeStr = dateTimeStr;
                ChromeUtils.updateItem(newItem).then(r => {
                    console.log("item updated")
                    console.log(r)
                    // TODO : clear previous timeout and define new one
                    // TODO : change text message
                })
            })
        }
    } else {
        showErrorMessage(scheduleMessageWarning.warningMessage)
    }

}


const sendMessage = async (id) => {
    const item = await ChromeUtils.getScheduleMessageById(id)
    if (client.state === Globals.SENDING_STATE){
        const sendingInterval = setInterval(()=>{
            if (client.state === Globals.UNUSED_STATE){
                clearInterval(sendingInterval)
                sendMessage(id)
            }
        },50)
    }else {
        client.state = Globals.SENDING_STATE;
        return new Promise(((resolve,reject) => {
            if (item.type === Globals.CONTACT_PARAM){
                console.log("starting to sending message to id: " + id)
                client.sendingType = Globals.SINGLE_CONTACT_SENDING;
                let element = document.createElement("a");
                element.href = `https://web.whatsapp.com/send?phone=${item.media}&text=${item.message}`;
                element.id = "mychat";
                document.body.append(element);
                let p1 = document.getElementById("mychat");
                p1.click();
                const waitForChatInterval = setInterval(()=> {
                    const chatDetails = getChatDetails();
                    if (chatDetails.chatId === item.chatId){
                        clearInterval(waitForChatInterval)
                        const waitForTextInterval = setInterval(async () => {
                            const composeBoxElement = document.querySelector(WhatsAppGlobals.composeBoxElement);
                            if (composeBoxElement){
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
                                            client = {state: Globals.UNUSED_STATE , sendingType: ""}
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
                        } , 50)
                    }
                },300)
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
                chatId : currentChatDetails.chatId ,
                media: currentChatDetails.media ,
                type : currentChatDetails.type,
                imageUrl,
                chatTitleElement,
                dateTimeStr,
                notifyBeforeSending ,
                messageSent: false ,
                deleted : false
            };
            console.log(data);
            const currentSchedulerMessages = await ChromeUtils.getSchedulerMessages();
            const updatedSchedulerMessages = [...currentSchedulerMessages, data];
            ChromeUtils.updateSchedulerMessages(updatedSchedulerMessages).then(r => {
                console.log(r)
            });
            await setTimeOutForMessage(id,chatName,elapsedTime,notifyBeforeSending);
            resolve(true);
        } catch (error) {
            console.log(error)
        }
    });
}


async function checkForUserTyping(seconds) {
    let userIsTyping = false;
    let initialTexts = await  getAllTexts().then(result =>  result.sort());
    return new Promise(resolve => {
        const typeCheckingInterval = setInterval(() => {
            seconds--;
            if (seconds <= 0 || userIsTyping) {
                clearInterval(typeCheckingInterval);
                resolve(userIsTyping);
            }else {
                getAllTexts().then(currentTexts => {
                    let equals = GeneralUtils.areArrayEqual(currentTexts.sort(), initialTexts);
                    if (!equals) {userIsTyping = true;}
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


function setTimeOutForMessage(id , chatName , elapsedTime , notifyBeforeSending) {
        if (notifyBeforeSending){
            activeMessagesTimeout[id] = setTimeout(async () => {
                let userIsTyping = await checkForUserTyping(Globals.USER_TYPING_WARNING_TIME)
                if (userIsTyping){
                    showUserTypingAlert(Globals.USER_TYPING_WARNING_TIME * Globals.SECOND , chatName)
                    await GeneralUtils.sleep(Globals.USER_TYPING_WARNING_TIME)
                }
                startMessageSending(id)
            } , elapsedTime - (Globals.USER_TYPING_WARNING_TIME * Globals.SECOND))
        }else {
            activeMessagesTimeout[id] = setTimeout(()=>{
                startMessageSending(id)
            } , elapsedTime)
        }

}

function startMessageSending(id) {
    sendMessage(id).then((result)=>{
        console.log("send message function done , result: " +result );
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

function openSchedulerModal() {
    schedulerModal.style.display = "block";
    modalBackdrop.style.display = "block";
    let currentDate = new Date();
    dateInputSchedulerModal.value = currentDate.toISOString().slice(0, 10);
    hourSelectorSchedulerModal.selectedIndex = currentDate.getHours();
    minuteSelectorSchedulerModal.selectedIndex = currentDate.getMinutes()
    let textInput  = document.querySelectorAll('[class*="text-input"]')[1];
    if (textInput.textContent !== Globals.DEFAULT_WHATSAPP_CHAT_PLACEHOLDER){
        messageSchedulerModal.value = textInput.textContent
    }
}

function showUserTypingAlert(timer,contactName) {
    let timerInterval
    Swal.fire({
        title: ` תזמון הודעה ל ${contactName}`,
        html: 'ההודעה תשלח בעוד <b></b> שניות',
        timer: timer,
        timerProgressBar: false,
        didOpen: () => {
            //Swal.showLoading()
            const b = Swal.getHtmlContainer().querySelector('b')
            timerInterval = setInterval(() => {
                b.textContent = Math.ceil(Swal.getTimerLeft()/1000).toString()
            }, 1000)
        },
        willClose: () => {
            clearInterval(timerInterval)
        }
    }).then((result) => {
        if (result.isConfirmed){}
        if (result.dismiss === Swal.DismissReason.timer) {
            console.log('I was closed by the timer')
        }
    })
}

const showErrorMessage = (message) => {
    Swal.fire({
        icon: 'error',
        title: 'אופס',
        text: message,
    }).then()
}

const showToastMessage =(position,timer,timerProgressBar,title)=>{
    const Toast = Swal.mixin({
        toast: true,
        position: position,
        showConfirmButton: false,
        timer: timer,
        timerProgressBar: timerProgressBar,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    })

    Toast.fire({
        icon: 'success',
        title: title
    })
}