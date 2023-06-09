import * as Globals from "./globals";
import {ISR_PREFIX, ISRAEL_PARAM} from "./globals";

export async function clearChildesFromParent(parentNode) {
    while (parentNode.firstChild) {
        parentNode.removeChild(parentNode.firstChild)
    }
}

export function sortByProperty(arr, key, sortOrder) {
    const sortedArray = arr.slice();

    sortedArray.sort((a, b) => {
        const valueA = a[key];
        const valueB = b[key];

        if (typeof valueA === "string" && typeof valueB === "string") {
            // Sort alphabetically if both values are strings
            if (valueA < valueB) {
                return sortOrder === "asc" ? -1 : 1;
            } else if (valueA > valueB) {
                return sortOrder === "asc" ? 1 : -1;
            }
        } else if (typeof valueA === "number" && typeof valueB === "number") {
            // Sort numerically if both values are numbers
            return sortOrder === "asc" ? valueA - valueB : valueB - valueA;
        }

        return 0;
    });

    return sortedArray;
}

export const areArrayEqual = (arr1, arr2) => {
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
export const containsDuplicates = (array) => {
    return array.length !== new Set(array).size;
}

export function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export const simulateKeyPress = (type, keyName) => {
    document.dispatchEvent(new KeyboardEvent(type, {key: keyName, bubbles: true}));
};


export function removeLeadingZeros(phoneNumber) {
    let numberString = phoneNumber.toString();
    numberString = numberString.replace(/^0+/, '');
    return numberString
}

export function convertToTitle(text) {
    const words = text.toLowerCase().split(' ');
    const titleCaseWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
    return titleCaseWords.join(' ');   // Join the title case words back into a single string
}


export const deleteTextInput = async (inputElement) => {
    while (inputElement.textContent.length > 0) {
        simulateKeyPress('keydown', 'Backspace');
        simulateKeyPress('keyup', 'Backspace');
        await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for a short delay before each delete action
    }
};


export const pasteText = (input, text) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text', text);
    const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true
    });
    input.click()
    setTimeout(() => {
        input.dispatchEvent(event)
    }, 750)

};


export function removeSpaces(word) {
    return word.replace(/\s/g, "");
}

export function listFadeIn(element, duration) {
    let start = performance.now();
    element.style.opacity = "0";

    function update() {
        let now = performance.now();
        let time = Math.min(1, (now - start) / duration);
        element.style.opacity = time;
        if (time < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

export function getDB(dbName) {
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

export function getObjectStoresByKeyFromDB(db, key) {
    return new Promise(((resolve) => {
        let transaction = db.transaction(key, 'readonly')
        let objectStore = transaction.objectStore(key);
        let getAllRequest = objectStore.getAll();
        getAllRequest.onsuccess = () => {
            resolve(getAllRequest)
        }
    }))
}

export const getAllParticipantsFromIndexDB = async (modelStorageDB) => {
    let items;
    await getObjectStoresByKeyFromDB(modelStorageDB, 'participant').then((response) => {
        items = response.result;
    })
    return items;
}

export function getObjectStoreByIndexFromDb(db, key, indexName, query) {
    return new Promise((async (resolve) => {
        let transaction = db.transaction(key, 'readonly');
        let objectStore = transaction.objectStore(key);
        let index = objectStore.index(indexName.toString());
        let getAllRequest = index.getAll(query);
        getAllRequest.onsuccess = () => {
            resolve(getAllRequest)
        };
    }))
}

export function getAllObjectStoreByIndexFromDb(db, key, indexName) {
    return new Promise((async (resolve) => {
        let transaction = db.transaction(key, 'readonly');
        let objectStore = transaction.objectStore(key);
        let index = objectStore.index(indexName.toString());
        let getAllRequest = index.getAll();
        getAllRequest.onsuccess = () => {
            resolve(getAllRequest)
        };
    }))
}

export function getChatDetails() {
    return new Promise((resolve, reject) => {
        let tries = 0;
        const intervalId = setInterval(() => {
            const element = document.querySelector("[data-testid*='conv-msg']");
            if (element) {
                const dataTestId = element.getAttribute("data-testid");
                const parts = dataTestId.split("_");
                const chatId = parts[1];
                let chatType, media;
                if (chatId.includes("@g.us")) {
                    media = document.querySelector('span[data-testid="conversation-info-header-chat-title"]').textContent;
                    chatType = Globals.GROUP_PARAM;
                } else {
                    media = chatId.split("@")[0];
                    chatType = Globals.CONTACT_PARAM;
                }
                clearInterval(intervalId);
                resolve({chatType, media, chatId});
            } else {
                tries++;
                if (tries >= 50) {
                    clearInterval(intervalId);
                    reject(new Error("Failed to get chat details."));
                }
            }
        }, 50);
    }).catch(error => {
        console.log("Error in getChatDetails:", error);
    });
}


export const addScrollingAbility = (list, maxHeight) => {
    list.style.height = maxHeight
    list.style.overflowY = "scroll"
}

// export function getCurrentDateTime() {
//     const currentDate = new Date();
//     const day = String(currentDate.getDate()).padStart(2, '0');
//     const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
//     const year = currentDate.getFullYear();
//     const hours = String(currentDate.getHours()).padStart(2, '0');
//     const minutes = String(currentDate.getMinutes()).padStart(2, '0');
//     const seconds = String(currentDate.getSeconds()).padStart(2, '0');
//     return `${day}/${month}/${year} , ${hours}:${minutes}:${seconds}`;
// }

function addModalToDOM(modalContainer) {
    let modalBackdrop = document.createElement('div');
    modalBackdrop.className = "modal-backdrop";
    document.body.appendChild(modalContainer)
    document.body.appendChild(modalBackdrop)

}

export function removeElement(selector) {
    const targetElement = document.querySelector(selector);
    if (targetElement && targetElement.parentNode) {
        targetElement.parentNode.removeChild(targetElement);
    }
}

export function capitalizeFirstLetter(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

export function getDateAsString(currentDate = new Date()) {
    let year = currentDate.getFullYear();
    let month = String(currentDate.getMonth() + 1).padStart(2, '0');
    let day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getFullDateAsString(date = new Date()) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    const dateString = `${year}-${month}-${day}`;
    const timeString = `${hours}:${minutes}`;
    return `${dateString} ${timeString}`;
}


function clearModalFromDOM(containerClassName) {
    document.getElementsByClassName(containerClassName)[0].remove()
    document.getElementsByClassName('modal-backdrop')[0].remove()
}


export function createTable(headers, data) {
    let tableContainer = document.createElement('div');
    tableContainer.className = "fb-table-container";
    const table = document.createElement('table');
    table.classList.add('fb-table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        th.classList.add('fb-th');
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        if (index % 2 === 0) {
            row.classList.add('fb-tr', 'even-row');
        } else {
            row.classList.add('fb-tr', 'odd-row');
        }
        Object.values(item).forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            td.classList.add('fb-td'); // Add the custom cell class
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table)
    return tableContainer;
}

export function formatPhoneNumber(phoneNumber, formatType) {
    let newPhone = phoneNumber.trim();
    newPhone = newPhone.replace(/\D/g, ''); // Remove any non-digit characters
    switch (formatType) {
        case ISRAEL_PARAM:
            if (newPhone.startsWith('05')) {
                newPhone = ISR_PREFIX + newPhone.slice(1)
            }
            if (newPhone.startsWith('5')) {
                newPhone = ISR_PREFIX + newPhone;
            }
    }
    return newPhone;
}


export function removeDuplicates(arr, keyToCheck) {
    return arr.reduce((accumulator, currentRow) => {
        const isDuplicate = accumulator.some((item) => item[keyToCheck] === currentRow[keyToCheck]);
        if (!isDuplicate) {
            accumulator.push(currentRow);
        }
        return accumulator;
    }, [])
}


export function removeNonDigits(str) {
    return str.replace(/\D/g, '');
}

export function waitForNode(parentNode, selector) {
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

export function waitForNodeWithTimeOut(parentNode, selector, timeout) {
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


export function waitForElementTextContent(parentElement, targetElementSelector) {
    return new Promise((resolve, reject) => {
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                const targetElement = mutation.target.querySelector(targetElementSelector);
                if (targetElement && targetElement.textContent.trim() !== "") {
                    observer.disconnect();
                    resolve(targetElement);
                    return;
                }
            }
        });

        observer.observe(parentElement, {childList: true, subtree: true});
        setTimeout(() => {
            observer.disconnect();
            reject("Timeout: Element with non-empty content not found.");
        }, 5000); // Adjust the timeout value as needed
    });
}

export function addSelectOptions(selector, selectorName) {
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

