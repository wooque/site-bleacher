let whitelist;

byId("whitelistTab").onclick = () => {
    chrome.runtime.sendMessage({"action": "whitelist_tab"});
};

byId("clean").onclick = () => {
    chrome.runtime.sendMessage({"action": "clean"});
};

byId("settings").onclick = () => {
    window.open("options.html", "_blank");
    window.close();
};

const toogleWhitelist = (domain) => {
    if (whitelist.includes(domain)) {
        whitelist = whitelist.filter(e => e != domain);
    } else {
        whitelist.push(domain);
    }
    const rules = whitelist.map(domainToRule);
    saveWhitelist(rules);
    render();
};

const getBackgroundPage = async () => {
    return new Promise(resolve => {
        chrome.runtime.getBackgroundPage(resp => {
            resolve(resp);
        });
    });
};

const render = async () => {
    const tab = await getCurrentTab();
    if (!tab || !isWebPage(tab.url)) return;
    if (tab.incognito) return;

    const cookies = await getCookiesForUrl(tab.url);

    if (!whitelist) {
        const wl = await getWhitelist();
        whitelist = wl.map(r => cleanRule(r));
    }
    const domains = new Set();

    for (let c of cookies) {
        let domain = normalizeDomain(cookieDomain(c));
        domains.add(domain);
    }
    const tabDomain = getDomain(tab.url);
    if (!domains.has(tabDomain)) {
        domains.add(tabDomain);
    }
    const table = byId("cookies");
    table.innerHTML = "";
    for (let domain of domains) {
        const action = whitelist.includes(domain) ? "remove": "whitelist";

        const tr = document.createElement("tr");

        const dtd = document.createElement("td");
        dtd.innerText = domain;
        dtd.classList.add("domain");
        dtd.classList.add(action);
        tr.appendChild(dtd);

        const btd = document.createElement("td");
        btd.className = "actionTd";

        const but = document.createElement("button");
        but.textContent = action;
        but.onclick = () => toogleWhitelist(domain);
        but.className = "action";
        btd.appendChild(but);

        tr.appendChild(btd);
        table.appendChild(tr);
    }
    const background = await getBackgroundPage();

    byId("settings").style.marginTop = "5px";
    byId("clean").style.display = "block";
    byId("whitelistTab").checked = tab.id in background.whitelistTabs;
    byId("whitelistTabCont").style.display = "block";
    document.body.style = "min-width: 150px";
};

render();
chrome.runtime.sendMessage({"action": "update_badge"});
