// eslint-disable-next-line no-unused-vars
const getCookies = (details) => new Promise(resolve => {
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
    const cookies = await getCookies({url: url});
    const base = baseDomain(getDomain(url));
    const cookiesBase = await getCookies({domain: base});
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
        const bd1 = baseDomain(cleanRule(r1));
        const bd2 = baseDomain(cleanRule(r2));
        return bd1.localeCompare(bd2);
    });
    chrome.runtime.sendMessage({
        "action": "update_whitelist",
        "whitelist": rules,
    });
    chrome.storage.local.set({whitelist: rules});
};

// eslint-disable-next-line no-unused-vars
const getWhitelist = () => new Promise(resolve => {
    chrome.storage.local.get(["whitelist"], (result) => {
        if (!result.whitelist) return resolve([]);
        resolve(result.whitelist);
    });
});