const injectPatch = () => {
    const html = document.getElementsByTagName("html")[0];
    const s = document.createElement("script");
    s.setAttribute("type", "text/javascript");
    s.setAttribute("src", chrome.extension.getURL("indexeddb_patch.js"));
    html.appendChild(s);
};

injectPatch();

chrome.runtime.onMessage.addListener((message) => {

    switch(message.action) {
    case "clean_storage":
        localStorage.clear();
        for (let db of message.data) {
            window.indexedDB.deleteDatabase(db);
        }
        break;
    }
});

let lastIndexedDbs = [];

setInterval(() => {
    const html = document.getElementsByTagName("html")[0];
    const idbs = html.dataset.sbIndexedDbs;
    if (!idbs) return;

    const indexedDbs = idbs.split(",");
    if (indexedDbs == lastIndexedDbs) return;

    chrome.runtime.sendMessage(
        {
            "action": "update_indexeddbs",
            "data": indexedDbs,
        }
    );
}, 2000);