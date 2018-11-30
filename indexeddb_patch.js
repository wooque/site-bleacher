const oldIndexedDBOpen = window.indexedDB.open;
function newIndexedDBOpen(arg1) {
    const e = new CustomEvent("new_indexdb", { detail: arg1 });
    document.dispatchEvent(e);
    return oldIndexedDBOpen.apply(this, [arg1]);
}
newIndexedDBOpen.bind(window.indexedDB);
window.indexedDB.open = newIndexedDBOpen;
