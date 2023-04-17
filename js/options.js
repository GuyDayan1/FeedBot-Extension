// Saves options to chrome.storage
function save_options() {

    chrome.storage.sync.set({

    }, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {

    chrome.storage.sync.get({

    }, function(items) {

    });
}
document.querySelector('.contact-us').addEventListener('click' , ()=>{
    // let keyboardRow = document.querySelector('.keyboard-row').innerHTML;
    // document.querySelector('.keyboard-holder').innerHTML += keyboardRow;
    // let newRow = document.createElement('div');
    // newRow.className = "keyboard-row"
    // newRow.innerHTML = keyboardRow;
})
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);