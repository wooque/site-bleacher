const oldIndexedDBOpen = window.indexedDB.open;
function newIndexedDBOpen(arg1) {
    const html = document.getElementsByTagName("html")[0];
    let idbs = html.dataset.sbIndexedDbs;
    if (idbs) {
        idbs = idbs.split(",");
    } else {
        idbs = [];
    }
    if (!idbs.includes(arg1)) {
        idbs.push(arg1);
        html.dataset.sbIndexedDbs = idbs.join(",");
    }
    return oldIndexedDBOpen.apply(this, [arg1]);
}
newIndexedDBOpen.bind(window.indexedDB);
window.indexedDB.open = newIndexedDBOpen;
