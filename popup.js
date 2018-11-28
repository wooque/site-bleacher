const byId = (id) => document.getElementById(id);

byId("clean").onclick = () => {
    chrome.runtime.sendMessage({"action": "clean"});
};