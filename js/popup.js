import * as GeneralUtils from "./utils/general-utils"


document.addEventListener('DOMContentLoaded', function() {
    let tabButtons = document.getElementsByClassName('tab-btn');
    console.log(tabButtons)

    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].addEventListener('click', function() {
            let tabName = this.getAttribute('data-tab');
            showTab(tabName).then(()=>{});
        });
    }

     async function showTab(tabName) {
         let activeTabBody = document.getElementById('active-tab-body');
         if (activeTabBody.hasChildNodes()) {
             await GeneralUtils.clearChildesFromParent(activeTabBody);
         }
         let tabBody = createTabBody(tabName)
         activeTabBody.appendChild(tabBody)
     }


    function createTabBody(tabName) {
        let tabBody;
        switch (tabName){
            case 'settingsTab':
                tabBody = createSettingsContent()
                break;
            case 'guidesTab':
                tabBody = createGuideContent()
                break;
            case 'statisticsTab':
                tabBody = createStatisticsContent()
                break;
        }
        return tabBody;

    }

    function createSettingsContent() {
        let settingsContent = document.createElement('div');
        settingsContent.id = 'settingsContent';
        settingsContent.innerHTML = '<h2>Settings</h2><p>This is the settings tab.</p>';
        return settingsContent;
    }
    function createGuideContent() {
        let guideContent = document.createElement('div');
        guideContent.id = 'guideContent';
        guideContent.innerHTML = '<h2>Guide</h2>' +
            '<p>It is recommended to disable the memory saver functionality in Chrome for better performance.</p>' +
            '<div>Turn off the memory saver</div>' +
            '<img id="memory-saver" src="../images/memory-saver.png" alt="Memory Saver"/>' +
            '<div>Active Don\'t allow closed sites to finish sending or receiving data</div>' +
            '<img id="background-sync" src="../images/background-sync.png" alt="Background Sync"/>' ;
        guideContent.querySelector('#background-sync').addEventListener('click' , ()=>{
            chrome.tabs.create({ url: 'chrome://settings/content/backgroundSync' });

        })
        guideContent.querySelector('#memory-saver').addEventListener('click' , ()=>{
            chrome.tabs.create({ url: 'chrome://settings/performance' });

        })
        return guideContent;
    }




    function createStatisticsContent() {
        let statisticsContent = document.createElement('div');
        statisticsContent.id = 'statisticsContent';
        statisticsContent.innerHTML = '<h2>Statistics</h2><p>This is the statistics tab.</p>';
        return statisticsContent;
    }

    // for (let i = 0; i < guideItems.length; i++) {
    //     guideItems[i].addEventListener('click', function() {
    //         let guideId = this.getAttribute('data-guide');
    //         showGuide(guideId);
    //     });
    // }
    //
    // function showGuide(guideId) {
    //     for (let i = 0; i < guideItems.length; i++) {
    //         guideItems[i].classList.remove('active');
    //     }
    //     document.querySelector(`[data-guide="${guideId}"]`).classList.add('active');
    // }
    //
    // // Show the first guide by default
    // showGuide('memorySave');
});
