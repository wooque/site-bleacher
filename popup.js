let whitelist;

byId("clean").onclick = () => {
    chrome.runtime.sendMessage({"action": "clean"});
};

const toogleWhitelist = (domain) => {
    if (whitelist.includes(domain)) {
        whitelist = whitelist.filter(e => e != domain);
    } else {
        whitelist.push(domain);
    }
    const rules = [];
    for (let r of whitelist) {
        const rreg = r.replace(".", "\\.");
        rules.push(`^${rreg}$`);
    }
    saveWhitelist(rules);
    render();
};

const render = async () => {
    const tab = await getCurrentTab();
    const cookies = await getCookiesForUrl(tab.url);
    if (!cookies) return;
    if (!whitelist) {
        const wl = await getWhitelist();
        whitelist = wl.map(r => cleanRule(r));
    }
    const domains = new Set();

    for (let c of cookies) {
        let domain = normalizeDomain(cookieDomain(c));
        domains.add(domain);
    }
    const table = byId("cookies");
    table.innerHTML = "";
    for (let domain of domains) {
        const tr = document.createElement("tr");

        const dtd = document.createElement("td");
        dtd.innerText = domain;
        tr.appendChild(dtd);

        const btd = document.createElement("td");

        const but = document.createElement("button");
        const button = whitelist.includes(domain) ? "remove": "whitelist";
        but.innerHTML = button;
        but.onclick = () => toogleWhitelist(domain);
        btd.appendChild(but);

        tr.appendChild(btd);
        table.appendChild(tr);
    }
};

render();