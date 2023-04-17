import * as utils from "./utils/utils";
import Swal from "sweetalert2";
import * as globals from "./utils/globals"
import {sleep} from "./utils/utils";


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
let popupBackground;




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
    await addSchedulerListToDOM();
    await checkForChatElementListener();
    load = true;
};


function addFeedBotIcon() {
    const headerElementObserver = new MutationObserver(async () => {
        headerElement = document.querySelector('header[data-testid="chatlist-header"]');
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
            cellFrameElement = document.querySelector('div[data-testid="cell-frame-container"]');
            utils.clearStorage()
        }

    });
    headerElementObserver.observe(document.body, {childList: true, subtree: true});
}

function addModalToDOM() {
    let modal = document.getElementById("myModal");
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
    waitForNode(document.body, "div[id=myModal]").then((modal) => {
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
        closeSchedulerModal.addEventListener('click', () => {clearModal();})
        cancelSchedulerModalButton.addEventListener('click', () => {clearModal()})
        sendButtonSchedulerModal.addEventListener("click", async () => {
            await handleSendButtonClick()
        });

    })

    /// background for popups
    popupBackground = document.createElement('div');
    popupBackground.className = "popup-background";
    document.body.appendChild(popupBackground)
}

function clearModal() {
    schedulerModal.style.display = "none";
    popupBackground.style.display = "none"
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
        const paneSideElement = document.getElementById("pane-side");
        schedulerListContainer.style.display = "none";
        paneSideElement.style.display = "block";
        schedulerMessagesDisplay = false;
    })

    schedulerListContainer.appendChild(backToChatList)
    schedulerListContainer.appendChild(messagesList);


    waitForNode(document.body, "div[id=pane-side]").then((element) => {
        element.insertAdjacentElement('afterend', schedulerListContainer)
    })

}


function addFeedBotOptionList() {
    const feedBotList = document.createElement("ul");
    feedBotList.className = "feedBot-list";
    for (let i = 0; i < globals.FEEDBOT_LIST_OPTIONS.length; i++) {
        const listItem = document.createElement("li");
        listItem.textContent = globals.FEEDBOT_LIST_OPTIONS[i];
        feedBotList.appendChild(listItem);
        switch (globals.FEEDBOT_LIST_OPTIONS[i]) {
            case "הודעות מתוזמנות":
                listItem.addEventListener("click", showScheduledMessages)
                break;
            case "הגדרות":
                listItem.addEventListener("click", openSettings);
                break;
            case "יצא את כל המשתתפים":
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
            if (item.participants.length > 0 || item.participants !== undefined){
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
        const paneSideElement = document.getElementById("pane-side");
        const messagesList = document.getElementsByClassName("messages-list")[0];
        paneSideElement.style.display = "none"
        messagesContainerElement.style.display = "block"
        await utils.clearChildesFromParent(messagesList)
        const schedulerMessages = await utils.getSchedulerMessages();
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
                await utils.clearChildesFromParent(firstCellFrameChild)
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
                await utils.clearChildesFromParent(lastMessageStatus)
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
                    const cancelMessageButton = document.createElement('button')
                    cancelMessageButton.textContent = "מחק"
                    cancelMessageButton.className = "custom-cancel-button"
                    cancelMessageButton.setAttribute("key", item.id)
                    cancelMessageButton.addEventListener('click' , (e)=>{
                        Swal.fire({
                            title: 'ביטול הודעה',
                            text: "האם אתה בטוח שתרצה לבטל את תזמון הודעה זו?",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#3085d6',
                            cancelButtonColor: '#d33',
                            confirmButtonText: 'כן',
                            cancelButtonText : "בטל" ,
                            customClass: {
                                confirmButton: 'custom-confirm-button-sa',
                                cancelButton: 'custom-cancel-button-sa'
                            }
                        }).then((result) => {
                            if (result.isConfirmed) {
                                item.deleted = true;
                                console.log("in swal")
                                console.log(item)
                                utils.updateItem(item)
                                Swal.fire(
                                    'הודעה נמחקה',
                                    'ההודעה שתזמנת נמחקה',
                                )
                            }
                        })
                    })
                    const editMessageButton = document.createElement('button')
                    editMessageButton.textContent = "ערוך"
                    editMessageButton.className = "custom-edit-button"
                    editMessageButton.style.marginTop = "10px"
                    editMessageButton.setAttribute("key", item.id)

                    iconPlaceElement.insertBefore(cancelMessageButton, iconPlaceElement.firstChild);
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
    waitForNode(document.body, "div[id=pane-side]").then(r => {
        document.body.addEventListener('click', () => {
            waitForNodeWithTimeOut(document.body, "header[data-testid=conversation-header]", 3000).then((element) => {
                const newChatDetails = getChatDetails();
                if (newChatDetails.chatId != currentChatDetails.chatId) {
                    checkForChatElement()
                    currentChatDetails = {...newChatDetails}
                }
            })
        })
    })
}


function checkForChatElement() {
    return new Promise((resolve) => {
        waitForNodeWithTimeOut(document.body, 'div[data-testid="compose-box"]', 3000)
            .then((element) => {
                addSchedulerButton()
                resolve(true)
            })
            .catch((error) => {
                resolve(false);
            });
    });
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
        type = globals.GROUP_PARAM
    } else {
        media = chatId.split("@")[0]
        type = globals.CONTACT_PARAM
    }
    return {type, media, chatId}
}

async function addSchedulerButton() {
    const composeBoxElement = document.querySelector('div[data-testid="compose-box"]')
    const chatElement = document.querySelector('footer');
    let copyAbleArea = chatElement.childNodes[0]
    const childElements = copyAbleArea.children;
    let containsClockIcon = false;
    for (let i = 0; i < childElements.length; i++) {
        const childElement = childElements[i];
        if (childElement.id === 'clock-icon') {
            containsClockIcon = true;
            break;
        }
    }
    if (!containsClockIcon) {
        const pttElement = composeBoxElement.childNodes[1].childNodes[0].childNodes[1].childNodes[1];
        const clockIcon = pttElement.cloneNode(true)
        clockIcon.id = "clock-icon"
        clockIcon.title = "תזמון הודעה"
        const buttonChild = clockIcon.childNodes[0]
        const spanChild = buttonChild.childNodes[0]
        buttonChild.setAttribute('data-testid', 'scheduler-btn');
        buttonChild.setAttribute('aria-label', 'תזמון הודעה');
        spanChild.setAttribute('data-testid', 'scheduler');
        spanChild.setAttribute('data-icon', 'scheduler');
        const svgElement = clockIcon.childNodes[0].childNodes[0].childNodes[0]
        svgElement.style.width = "30px"
        svgElement.style.height = "30px"
        svgElement.style.marginTop = "10px"
        svgElement.style.marginLeft = "15px"
        const svgPathElement = clockIcon.childNodes[0].childNodes[0].childNodes[0].childNodes[0];
        svgPathElement.setAttribute("d", globals.CLOCK_SVG_PATH_VALUE);
        composeBoxElement.childNodes[1].childNodes[0].childNodes[1].appendChild(clockIcon)
        clockIcon.removeEventListener('click', () => {});
        clockIcon.addEventListener('click', () => {
            schedulerModal.style.display = "block";
            popupBackground.style.display = "block";
            let currentDate = new Date();
            let textInput  = document.querySelectorAll('[class*="text-input"]')[1];
            dateInputSchedulerModal.value = currentDate.toISOString().slice(0, 10);
            hourSelectorSchedulerModal.selectedIndex = currentDate.getHours();
            minuteSelectorSchedulerModal.selectedIndex = currentDate.getMinutes()
            if (textInput.textContent != globals.DEFAULT_WHATSAPP_CHAT_TEXT){
                messageSchedulerModal.value = textInput.textContent
            }

        });
    }

}


function handleSendButtonClick() {
    let scheduleMessageWarning = {show : false , message : ""};
    let message = document.getElementById("message").value.trim();
    const date = document.getElementById("datepicker").value;
    const hour = document.getElementById("hour").value;
    let minute = document.getElementById("minute").value;

    if (message.length === 0){
        scheduleMessageWarning.show = true;
        scheduleMessageWarning.message = "ההודעה חייבת להכיל טקסט"
    }
    if (minute < 10) {minute = "0" + minute;}
    const dateTimeStr = date + " " + hour + ":" + minute;
    let scheduledTime = (new Date(dateTimeStr)).getTime();
    if (scheduledTime <= Date.now()) {scheduledTime = new Date().getTime()}
    schedulerModal.style.display = "none";
    popupBackground.style.display = "none"
    messageSchedulerModal.value = "";
    if (!scheduleMessageWarning.show){
        utils.getSchedulerMessages().then((schedulerMessages) => {
            const id = schedulerMessages.length > 0 ? (schedulerMessages[schedulerMessages.length - 1].id) + 1 : 0;
            saveMessage(id, message, scheduledTime, dateTimeStr).then((result) => {
            }).catch(() => {
                console.log("message not saved successfully")
            })
        }).catch((onerror) => {
            console.log("error in get scheduler messages")
        })
    }else {
        Swal.fire({
            icon: 'error',
            title: 'אופס',
            text: scheduleMessageWarning.message,
        })
    }

}


const sendMessage = async (id) => {
    const item = await utils.getScheduleMessageById(id)
    if (item.type === globals.CONTACT_PARAM){
        let element = document.createElement("a");
        element.href = `https://web.whatsapp.com/send?phone=${item.media}&text=${item.message}`;
        element.id = "mychat";
        document.body.append(element);
        let p1 = document.getElementById("mychat");
        p1.click();
        const waitForChatInterval = setInterval(()=> {
            const chatDetails = getChatDetails();
            if (chatDetails.chatId === item.chatId){   /// clear existing input if exist
                clearInterval(waitForChatInterval)
                const waitForTextInterval = setInterval(async () => {
                    const composeBoxElement = document.querySelector('div[data-testid="conversation-compose-box-input"]');
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
                                    utils.updateItem(item)
                                })
                                .catch(error => {
                                    console.log(error)
                                });

                        } else {
                            utils.simulateKeyPress('keydown', "Escape");
                            await sleep(1)
                            p1.click();
                        }
                    }
                } , 100)
            }
        },100)
    }

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
            const notifyBeforeSending = elapsedTime > globals.USER_TYPING_WARNING_TIME * globals.SECOND
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
            const currentSchedulerMessages = await utils.getSchedulerMessages();
            const updatedSchedulerMessages = [...currentSchedulerMessages, data];
            utils.updateSchedulerMessages(updatedSchedulerMessages).then(r => {
                console.log("updated scheduler messages")
                console.log(r)
            });
            if (notifyBeforeSending){
                setTimeout(async () => {
                    let userIsTyping = await checkForUserTyping(globals.USER_TYPING_WARNING_TIME)
                    if (userIsTyping){
                        showUserTypingAlert(globals.USER_TYPING_WARNING_TIME * globals.SECOND , chatName)
                        await utils.sleep(globals.USER_TYPING_WARNING_TIME)
                    }
                    sendMessage(id).then(()=>{console.log("message has been send")})
                } , elapsedTime - (globals.USER_TYPING_WARNING_TIME * globals.SECOND))
            }else {
                setTimeout(()=>{
                    sendMessage(id)
                } , elapsedTime)
            }
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
                    let equals = utils.areArrayEqual(currentTexts.sort(), initialTexts);
                    console.log(equals);
                    if (!equals) {
                        userIsTyping = true;
                    }
                });
            }
        }, globals.SECOND);
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
                // reject(()=>{console.log("time passed " + selector +" not found")});
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
                b.textContent = Math.ceil(Swal.getTimerLeft()/1000)
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

