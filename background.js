let whitelist = [];
let tabs = {};
let domains = {};
let shouldClean = {};
let indexeddbs = {};

const parseUrl = (url) => new URL(url);
const normalizeDomain = (domain) => domain.replace("www.", "");
const getDomain = (url) => normalizeDomain(parseUrl(url).host);

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

const cleanCookies = (details) => {
    details = details || {};
    chrome.cookies.getAll(
        details,
        (cookies) => {
            for (let cookie of cookies) {
                let domain = cookie.domain;
                if (domain.charAt(0) === ".") {
                    domain = domain.slice(1);
                }
                if (checkWhitelist(domain)) continue;

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
        }
    );
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

const clean = () => {
    chrome.tabs.query(
        {
            active: true,
            currentWindow: true,
        },
        (tabs) => {
            const tab = tabs[0];
            const url = parseUrl(tab.url);
            if (!url.protocol.startsWith("http")) return;

            if (!checkWhitelist(url.host)) {
                cleanCookies({url: tab.url});
                sendCleanStorage(tab);
            }
        }
    );
};

const onMessage = (message, sender, sendResponse) => {

    switch(message.action) {
        case "clean":
            clean();
            break;

        case "update_whitelist":
            newWhitelist = [];
            for (let rule of message.whitelist) {
                newWhitelist.push(new RegExp(rule));
            }
            whitelist = newWhitelist;
            break;
        case "update_indexeddbs":
            indexeddbs[sender.tab.id] = message.data;
            break;
    }
};

const onTabClose = (tabId, removeInfo) => {
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
                cleanCookies({url: url.toString()});
            }
        }
    }
}

const onTabCreate = (tab) => {
    if (!tab.url) return;
    const url = parseUrl(tab.url);
    if (!url.protocol.startsWith("http")) return;

    const first = !tabs[tab.id];
    tabs[tab.id] = url;

    const newDomain = normalizeDomain(url.host);
    if (newDomain in domains) {
        domains[newDomain]++;
    } else {
        domains[newDomain] = 1;
    }
    if (shouldClean[newDomain] === true
        || (first && !checkWhitelist(newDomain))) {
        sendCleanStorage(tab);
        delete indexeddbs[tab.id];
        delete shouldClean[newDomain];
    }
}

const onTabChange = (tabId, changeInfo, tab) => {
    const oldUrl = tabs[tabId];
    if (oldUrl && normalizeDomain(oldUrl.host) === getDomain(tab.url)) return;

    onTabClose(tabId, undefined);
    onTabCreate(tab);
}

chrome.runtime.onMessage.addListener(onMessage);
chrome.tabs.onCreated.addListener(onTabCreate);
chrome.tabs.onUpdated.addListener(onTabChange);
chrome.tabs.onRemoved.addListener(onTabClose);

loadWhitelist();
// TODO: enable periodic clean when its completed
//setInterval(() => cleanCookies(), 30000);
