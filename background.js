let whitelist = {};
let whitelistDomains = new Set();
let tabs = {};
let domains = {};
window.whitelistTabs = {};
let stores = new Set();

const debug = false;

const initGlobals = () => {
    chrome.tabs.query({}, (ts) => {
        for (let tab of ts) {
            const url = parseUrl(tab.url);
            if (!isWebPage(url)) continue;

            tabs[tab.id] = { url: url, store: tab.cookieStoreId };

            const nd = normalizeDomain(url.host);
            if (nd in domains) {
                domains[nd]++;
            } else {
                domains[nd] = 1;
            }
        }
    });
};

const storageGet = (key) => {
    return new Promise(resolve => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
};

const getCookieStores = () => {
    return new Promise(resolve => {
        chrome.cookies.getAllCookieStores(result => {
            resolve(result);
        });
    });
};

const checkWhitelist = (domain) => {
    domain = normalizeDomain(domain);
    const bd = baseDomain(domain);
    const rules = whitelist[bd] || [];
    for (let rule of rules) {
        if (rule.test(domain)) {
            return true;
        }
    }
    return false;
};

const updateWhitelist = (wl) => {
    whitelistDomains = new Set(wl.map(r => cleanRule(r)));
    const newWhitelist = {};
    for (let r of wl) {
        const bd = baseDomain(cleanRule(r));
        if (!(bd in newWhitelist)) {
            newWhitelist[bd] = [];
        }
        newWhitelist[bd].push(new RegExp(r));
    }
    whitelist = newWhitelist;
};

const loadWhitelist = async () => {
    const whitelist = await storageGet("whitelist");
    if (whitelist) {
        updateWhitelist(whitelist);
    }
};

const getHistory = (startTime, endTime) => {
    return new Promise(resolve => {
        chrome.history.search(
            {
                text: "",
                startTime: startTime,
                endTime: endTime,
                maxResults: 1000,
            },
            h => {
                resolve(h);
            }
        );
    });
};

const getHistoryOrigins = async () => {
    let lastHistory = await storageGet("lastHistory");
    lastHistory = lastHistory || 0;
    let origins = new Set();
    const start = Date.now();
    let endTime = start;

    while (endTime > lastHistory) {
        const history = await getHistory(lastHistory, endTime);
        for (let h of history) {
            if (!isWebPage(h.url)) continue;
            const url = new URL(h.url);
            origins.add(url.origin);
        }
        if (!history.length || history.length < 1000) break;
        endTime = history[history.length - 1].lastVisitTime;
    }
    chrome.storage.local.set({ "lastHistory": start });
    return origins;
};

const cleanBrowsingData = async (origins, ignore) => {
    for (let o of origins) {
        const domain = getDomain(o);

        if (checkWhitelist(domain)) continue;
        if (ignore && ignore.has(baseDomain(domain))) continue;

        let removalOptions = {};
        let removeData = {
            "indexedDB": true,
            "localStorage": true,
            "pluginData": true,
            "serviceWorkers": true,
        };
        if (isFirefox) {
            const url = new URL(o);
            removalOptions = {
                "hostnames": [url.hostname],
            };
        } else {
            removalOptions = {
                "origins": [o],
            };
            removeData = Object.assign(removeData, {
                "cacheStorage": true,
                "fileSystems": true,
                "webSQL": true
            });
        }
        if (debug) {
            console.log({ removalOptions, removeData });
        }
        chrome.browsingData.remove(
            removalOptions,
            removeData,
        );
    }
};

const cleanCookiesWithDetails = async (options) => {
    const cookieDetails = copyFields(options, ["url", "domain", "storeId"]);
    const cookies = await getCookies(cookieDetails);
    const whitelistCheckCache = {};
    let urlBaseDom;
    if (options.url) {
        urlBaseDom = baseDomain(getDomain(options.url));
    }
    if (options.domain) {
        urlBaseDom = baseDomain(options.domain);
    }
    for (let cookie of cookies) {
        const fullDomain = cookieDomain(cookie);
        const domain = normalizeDomain(fullDomain);
        if (!options.cleanBaseDomain && domain === urlBaseDom) continue;

        let isWhitelisted = whitelistCheckCache[domain];
        if (isWhitelisted === undefined) {
            isWhitelisted = checkWhitelist(domain);
            whitelistCheckCache[domain] = isWhitelisted;
        }
        if (isWhitelisted) continue;
        if (options.ignore
            && options.ignore.has(baseDomain(domain))) continue;

        let url;
        if (cookie.secure) {
            url = `https://${fullDomain}${cookie.path}`;
        } else {
            url = `http://${fullDomain}${cookie.path}`;
        }
        const removeData = {
            url: url,
            name: cookie.name,
        };
        if (isFirefox) {
            removeData.firstPartyDomain = cookie.firstPartyDomain;
        }
        removeData.storeId = cookieDetails.storeId;
        if (debug) {
            console.log(removeData);
        }
        chrome.cookies.remove(removeData);
        cleanBrowsingData([new URL(url).origin]);
    }
};

const periodicClean = async (ignore) => {
    const origins = await getHistoryOrigins();
    cleanBrowsingData(origins, ignore);
    for (let storeId of stores) {
        cleanCookiesWithDetails({ storeId, ignore });
    }
};

const cleanCookies = async (options) => {
    await cleanCookiesWithDetails(options);
    const bd = baseDomain(getDomain(options.url));
    if (options.cleanBaseDomain) {
        await cleanCookiesWithDetails({
            domain: bd,
            storeId: options.storeId,
            ignore: options.ignore,
        });
    }
};

const forceClean = async () => {
    const tab = await getCurrentTab();
    if (!tab) return;
    const url = parseUrl(tab.url);
    if (!isWebPage(url)) return;

    if (!checkWhitelist(url.host)) {
        await cleanCookies({
            url: tab.url,
            storeId: tab.cookieStoreId,
        });
        const origin = new URL(tab.url).origin;
        cleanBrowsingData([origin]);
    }
};

const onMessage = (message) => {
    switch (message.action) {
        case "open_options":
            chrome.tabs.create({ url: "options.html" });
            break;

        case "clean":
            forceClean();
            break;

        case "update_whitelist":
            updateWhitelist(message.whitelist);
            getCurrentTab().then(setBadge);
            break;

        case "update_badge":
            getCurrentTab().then(setBadge);
            break;

        case "whitelist_tab":
            getCurrentTab().then(tab => {
                if (tab.id in window.whitelistTabs) {
                    delete window.whitelistTabs[tab.id];
                } else {
                    const domain = baseDomain(getDomain(tab.url));
                    window.whitelistTabs[tab.id] = new Set([domain]);
                }
            });
            break;
    }
};

const onTabClose = async (tabId, removeInfo) => {
    if (removeInfo !== undefined) {
        if (tabId in window.whitelistTabs) {
            delete window.whitelistTabs[tabId];
        }
    }
    const tabData = tabs[tabId];
    if (!tabData || !isWebPage(tabData.url)) return;

    delete tabs[tabId];

    const url = tabData.url;
    const oldDomain = normalizeDomain(url.host);
    if (oldDomain in domains) {
        domains[oldDomain]--;

        if (domains[oldDomain] === 0) {
            delete domains[oldDomain];

            if (!(tabId in window.whitelistTabs)) {
                const isBase = oldDomain === baseDomain(oldDomain);
                let cleanBase = true;
                for (let otherDomain in domains) {
                    if (baseDomain(otherDomain) === baseDomain(oldDomain)) {
                        if (isBase) return;
                        cleanBase = false;
                        break;
                    }
                }
                await cleanCookies({
                    url: url.toString(),
                    storeId: tabData.store,
                    cleanBaseDomain: cleanBase,
                });
                const origin = new URL(url).origin;
                cleanBrowsingData([origin]);
            } else {
                window.whitelistTabs[tabId].add(baseDomain(oldDomain));
            }
        }
    }
};

const setBadge = async (tab) => {
    if (!tab || !isWebPage(tab.url)) return;
    if (tab.incognito) return;

    const cookies = await getCookiesForUrl(tab.url);

    const cookieDomains = new Set();
    for (let c of cookies) {
        let domain = normalizeDomain(cookieDomain(c));
        cookieDomains.add(domain);
    }
    const tabDomain = getDomain(tab.url);
    if (!cookieDomains.has(tabDomain)) {
        cookieDomains.add(tabDomain);
    }
    const total = cookieDomains.size;

    let whitelisted = 0;
    for (let d of cookieDomains) {
        if (whitelistDomains.has(d)) {
            whitelisted++;
        }
    }
    let badge = "";
    let color;

    if (whitelisted === total) {
        badge += whitelisted;
        color = "#4E9A06";

    } else if (whitelisted === 0) {
        badge += total;
        color = "#CD0000";

    } else {
        badge = `${whitelisted}/${total}`;
        color = "#C4A000";
    }
    chrome.browserAction.setBadgeText({
        text: badge,
        tabId: tab.id,
    });
    chrome.browserAction.setBadgeBackgroundColor({
        color: color,
        tabId: tab.id,
    });
};

const cleanBadge = (tabId) => {
    chrome.browserAction.setBadgeText({
        text: "",
        tabId: tabId,
    });
};

const onTabCreate = async (tab) => {
    const cs = await getCookieStores();
    for (let s of cs) {
        if (s.incognito) continue;
        stores.add(s.id);
    }
    if (!tab.url) return;
    const url = parseUrl(tab.url);
    if (!isWebPage(url)) return;

    const newDomain = normalizeDomain(url.host);
    if (tab.id in tabs) {
        const oldDomain = normalizeDomain(tabs[tab.id].url.host);
        if (oldDomain === newDomain) return;
    }
    tabs[tab.id] = { url: url, store: tab.cookieStoreId };

    if (newDomain in domains) {
        domains[newDomain]++;
    } else {
        domains[newDomain] = 1;
    }
    await setBadge(tab);
};

const onTabChange = async (tabId, changeInfo, tab) => {
    if (Object.keys(changeInfo).length === 1 && changeInfo.attention !== undefined) {
        return;
    }
    const oldTabData = tabs[tabId];
    if (oldTabData && baseDomain(oldTabData.url.host) === baseDomain(getDomain(tab.url))) {
        await setBadge(tab);
        return;
    }
    await onTabClose(tabId, undefined);
    await onTabCreate(tab);
    if (!isWebPage(tab.url)) {
        cleanBadge(tab.id);
    }
};

const onTabActivated = () => {
    getCurrentTab().then(setBadge);
};

const cleanCookiesCheckOpenTabs = () => {
    chrome.tabs.query({}, (ts) => {
        const ds = new Set(ts.map((t) => baseDomain(getDomain(t.url))));
        for (let s of Object.values(window.whitelistTabs)) {
            for (let e of s) {
                ds.add(e);
            }
        }
        periodicClean(ds);
    });
};

chrome.runtime.onMessage.addListener(onMessage);
chrome.tabs.onCreated.addListener(onTabCreate);
chrome.tabs.onUpdated.addListener(onTabChange);
chrome.tabs.onRemoved.addListener(onTabClose);
chrome.tabs.onActivated.addListener(onTabActivated);

initGlobals();
loadWhitelist();
setInterval(() => cleanCookiesCheckOpenTabs(), 15000);
setInterval(() => {
    getCurrentTab().then(setBadge);
}, 15000);
// TODO: remove in next version
chrome.storage.local.remove(["indexeddbs"]);