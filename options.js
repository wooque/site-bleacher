const render = async () => {
    const whitelist = await getWhitelist();
    const domains = whitelist.map(cleanRule);
    byId("whitelist").value = domains.join("\n");
};

render();

byId("saveWhitelist").onclick = () => {
    const whitelistStr = byId("whitelist").value;
    const domains = whitelistStr.trim().split(/\r?\n/g);
    const rules = domains.map(domainToRule);
    saveWhitelist(rules);
    render();
};
