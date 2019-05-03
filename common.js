const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;

// eslint-disable-next-line no-unused-vars
const getCookies = (details) => new Promise(resolve => {
    if (isFirefox) {
        details.firstPartyDomain = null;
    }
    chrome.cookies.getAll(
        details,
        (cookies) => resolve(cookies)
    );
});

// eslint-disable-next-line no-unused-vars
const getCurrentTab = () => new Promise(resolve => {
    chrome.tabs.query(
        {
            active: true,
            currentWindow: true,
        },
        (tabs) => resolve(tabs[0])
    );
});

const parseUrl = (url) => new URL(url);

// eslint-disable-next-line no-unused-vars
const cookieDomain = (cookie) => {
    let domain = cookie.domain;
    if (domain.charAt(0) === ".") {
        return domain.slice(1);
    }
    return domain;
};

const normalizeDomain = (domain) => domain.replace("www.", "");

// eslint-disable-next-line no-unused-vars
const getDomain = (url) => normalizeDomain(parseUrl(url).host);

const baseDomain = (domain) => {
    domain = domain.split(":")[0];
    const parts = domain.split(".");
    return parts.slice(-2).join(".");
};

// eslint-disable-next-line no-unused-vars
const isWebPage = (url) => {
    if (url.protocol !== undefined) {
        return url.protocol.startsWith("http");
    } else {
        return url.startsWith("http");
    }
};

// eslint-disable-next-line no-unused-vars
const getCookiesForUrl = async (url) => {
    const cookies = await getCookies({ url: url });
    const base = baseDomain(getDomain(url));
    const cookiesBase = await getCookies({ domain: base });
    return cookies.concat(cookiesBase);
};

// eslint-disable-next-line no-unused-vars
const byId = (id) => document.getElementById(id);

const cleanRule = d => d.replace(/\^|\\|\$/g, "");
// eslint-disable-next-line no-unused-vars
const domainToRule = d => "^" + d.replace(".", "\\.") + "$";

// eslint-disable-next-line no-unused-vars
const saveWhitelist = (rules) => {
    rules.sort((r1, r2) => {
        const cr1 = cleanRule(r1);
        const cr2 = cleanRule(r2);
        const bd1 = baseDomain(cr1);
        const bd2 = baseDomain(cr2);
        if (bd1 === bd2) {
            const prefix1 = cr1.replace(bd1, "");
            const prefix2 = cr2.replace(bd1, "");
            return prefix1.localeCompare(prefix2);
        } else {
            return bd1.localeCompare(bd2);
        }
    });
    chrome.runtime.sendMessage({
        "action": "update_whitelist",
        "whitelist": rules,
    });
    chrome.storage.local.set({ whitelist: rules });
};

// eslint-disable-next-line no-unused-vars
const getWhitelist = () => new Promise(resolve => {
    chrome.storage.local.get(["whitelist"], (result) => {
        if (!result.whitelist) return resolve([]);
        resolve(result.whitelist);
    });
});