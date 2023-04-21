export async function clearChildesFromParent(parentNode) {
    while (parentNode.firstChild) {
        parentNode.removeChild(parentNode.firstChild)
    }
}

export const areArrayEqual = (arr1, arr2)=>{
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

export const simulateKeyPress = (type,keyName) => {    //type = which action to do simulate  , keyName = which key to action
    document.dispatchEvent(new KeyboardEvent(type, {'key': keyName}));
    console.log("try to escape")
}