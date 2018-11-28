const byId = (id) => document.getElementById(id);

chrome.storage.local.get(["whitelist"], (result) => {
    if (!result.whitelist) return;
    byId("whitelist").value = result.whitelist.join("\n");
});

byId("saveWhitelist").onclick = () => {
    const whitelistStr = byId("whitelist").value;
    const rules = whitelistStr.trim().split(/\r?\n/g);
    chrome.runtime.sendMessage({
        "action": "update_whitelist",
        "whitelist": rules,
    });
    chrome.storage.local.set({whitelist: rules});
};
