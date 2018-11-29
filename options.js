const render = async () => {
    const whitelist = await getWhitelist()
    byId("whitelist").value = whitelist.join("\n");
};

render();

byId("saveWhitelist").onclick = () => {
    const whitelistStr = byId("whitelist").value;
    const rules = whitelistStr.trim().split(/\r?\n/g);
    saveWhitelist(rules);
    render();
};
