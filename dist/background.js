(()=>{"use strict";chrome.tabs.onActivated.addListener((function(e){chrome.tabs.query({active:!0,currentWindow:!0},(function(e){const t=e[0];t.url.includes("web.whatsapp.com")&&(console.log(t),setTimeout((()=>{chrome.storage.local.get(["schedulerMessages"],(e=>{(e.schedulerMessages||[]).filter((e=>!e.messageSent&&!e.deleted&&e.repeatSending&&e.scheduledTime-Date.now()>6e4)).length>0&&chrome.tabs.query({url:"https://web.whatsapp.com/*"},(function(e){if(e.length>0){const t=e[0].id;chrome.tabs.reload(t)}}))}))}),5e3))}))})),chrome.tabs.onUpdated.addListener(((e,t,n)=>{n.url.includes("web.whatsapp.com")&&console.log(n,t)})),chrome.runtime.onMessage.addListener(((e,t,n)=>{let s=e.data;if("get-html-file"===s.action){return function(e){return new Promise(((t,n)=>{const s=chrome.runtime.getURL(`html/${e}.html`);fetch(s).then((e=>e.text())).then((e=>{t(e)})).catch((e=>{n(e)}))}))}(s.fileName).then((e=>{n({data:e})})).catch((e=>{n({error:"Failed to fetch HTML file"})})),!0}"update-client-sending-state"===s.action&&(client.state=s.state,client.sendingType=s.sendingType,console.log(JSON.stringify(client)))}))})();