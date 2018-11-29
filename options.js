getWhitelist().then(whitelist => {
    byId("whitelist").value = whitelist.join("\n");
});

byId("saveWhitelist").onclick = () => {
    const whitelistStr = byId("whitelist").value;
    const rules = whitelistStr.trim().split(/\r?\n/g);
    saveWhitelist(rules);
};
