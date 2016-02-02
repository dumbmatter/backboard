if (typeof indexedDB === 'undefined') {
    GLOBAL.indexedDB = require('fake-indexeddb');
    GLOBAL.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
}