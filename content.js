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

const indexeddbs = [];

document.addEventListener("new_indexdb", (event) => {
    const db = event.detail;
    if (indexeddbs.includes(db)) return;

    indexeddbs.push(db);

    chrome.runtime.sendMessage(
        {
            "action": "update_indexeddbs",
            "data": indexeddbs,
        }
    );
});