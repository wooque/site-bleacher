let whitelist = [];
let tabs = {};
let domains = {};
let shouldClean = {};
let indexeddbs = {};

const initGlobals = () => {
    chrome.tabs.query({}, (ts) => {
        for(let tab of ts) {
            const url = parseUrl(tab.url)

            tabs[tab.id] = url;

            const nd = normalizeDomain(url.host);
            if (nd in domains) {
                domains[nd]++;
            } else {
                domains[nd] = 1;
            }
        }
    });
};

const checkWhitelist = (domain) => {
    domain = normalizeDomain(domain);
    for (let rule of whitelist) {
        if (rule.test(domain)) {
            return true;
        }
    }
    return false;
};

const loadWhitelist = () => {
    chrome.storage.local.get(["whitelist"], (result) => {
        if (!result.whitelist) return;
        for (let rule of result.whitelist) {
            whitelist.push(new RegExp(rule));
        }
    });
};

const cleanCookiesWithDetails = async (details, checkIgnore) => {
    const cookies = await getCookies(details);
    for (let cookie of cookies) {
        const domain = cookieDomain(cookie);
        if (checkWhitelist(domain)) continue;
        if (checkIgnore && checkIgnore(domain)) continue;

        let url;
        if (cookie.secure) {
            url = `https://${domain}${cookie.path}`;
        } else {
            url = `http://${domain}${cookie.path}`;
        }
        chrome.cookies.remove({
            url: url,
            name: cookie.name,
        });
    }
};

const cleanCookies = async (url, checkIgnore) => {
    await cleanCookiesWithDetails({url: url}, checkIgnore);
    const bd = baseDomain(getDomain(url));
    await cleanCookiesWithDetails({domain: bd}, checkIgnore);
};

const sendCleanStorage = (tab) => {
    chrome.tabs.sendMessage(
        tab.id,
        {
            "action": "clean_storage",
            "data": indexeddbs[tab.id] || [],
        }
    );
};

const clean = async () => {
    const tab = await getCurrentTab();
    const url = parseUrl(tab.url);
    if (!url.protocol.startsWith("http")) return;

    if (!checkWhitelist(url.host)) {
        await cleanCookies(tab.url);
        sendCleanStorage(tab);
    }
};

const onMessage = (message, sender, _sendResponse) => {

    switch(message.action) {
    case "clean":
        clean();
        break;

    case "update_whitelist":
        whitelist = message.whitelist.map((r) => new RegExp(r));
        break;

    case "update_indexeddbs":
        indexeddbs[sender.tab.id] = message.data;
        break;
    }
};

const onTabClose = async (tabId, _removeInfo) => {
    const url = tabs[tabId];
    if (!url) return;

    delete tabs[tabId];

    const oldDomain = normalizeDomain(url.host);
    if (oldDomain in domains) {
        domains[oldDomain]--;
        if (domains[oldDomain] === 0) {
            delete domains[oldDomain];
            if (!checkWhitelist(oldDomain)) {
                shouldClean[oldDomain] = true;
                await cleanCookies(url.toString());
            }
        }
    }
};

const setBadge = async (tab) => {
    const cookies = await getCookiesForUrl(tab.url);
    if (!cookies) return;
    const cookieDomains = new Set();
    for (let c of cookies) {
        let domain = normalizeDomain(cookieDomain(c));
        cookieDomains.add(domain);
    }
    if (cookieDomains.size) {
        chrome.browserAction.setBadgeText({
            text: "" + cookieDomains.size,
            tabId: tab.id,
        });
    }
};

const onTabCreate = async (tab) => {
    if (!tab.url) return;
    const url = parseUrl(tab.url);
    if (!url.protocol.startsWith("http")) return;

    tabs[tab.id] = url;

    const newDomain = normalizeDomain(url.host);
    if (newDomain in domains) {
        domains[newDomain]++;
    } else {
        domains[newDomain] = 1;
    }
    const first = domains[newDomain] === 1;
    if (shouldClean[newDomain] === true
        || (first && !checkWhitelist(newDomain))) {
        sendCleanStorage(tab);
        delete indexeddbs[tab.id];
        delete shouldClean[newDomain];
    }
    await setBadge(tab);
};

const onTabChange = async (tabId, _changeInfo, tab) => {
    const oldUrl = tabs[tabId];
    if (oldUrl && baseDomain(oldUrl.host) === baseDomain(getDomain(tab.url))) {
        await setBadge(tab);
        return;
    }
    await onTabClose(tabId, undefined);
    await onTabCreate(tab);
};

const onTabActivated = async (activeInfo) => {
    const url = tabs[activeInfo.tabId];
    if (!url) return;
    await setBadge({url: url.toString(), id: activeInfo.tabId});
}

const cleanCookiesCheckOpenTabs = () => {
    chrome.tabs.query({}, (ts) => {
        const ds = ts.map((t) => baseDomain(getDomain(t.url)));
        cleanCookiesWithDetails({}, (domain) => ds.includes(baseDomain(domain)));
    });
};

chrome.runtime.onMessage.addListener(onMessage);
chrome.tabs.onCreated.addListener(onTabCreate);
chrome.tabs.onUpdated.addListener(onTabChange);
chrome.tabs.onRemoved.addListener(onTabClose);
chrome.tabs.onActivated.addListener(onTabActivated);

initGlobals();
loadWhitelist();
setInterval(() => cleanCookiesCheckOpenTabs(), 10000);
