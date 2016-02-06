const iterate = require('./iterate');
const wrapRequest = require('./wrap-request');
const Index = require('./index');
let DB, Transaction;

class ObjectStore {
    constructor(dbOrTransaction, name) {
        if (!DB) { DB = require('./db'); }
        if (!Transaction) { Transaction = require('./transaction'); }

        if (dbOrTransaction instanceof DB) {
            this._db = dbOrTransaction;
        } else if (dbOrTransaction instanceof Transaction) {
            this._rawObjectStore = dbOrTransaction.objectStore(name);
        }
        this.name = name;
    }

    _getRaw(mode, resolve, reject) {
        if (this._rawObjectStore) {
            return this._rawObjectStore;
        }

        const tx = new Transaction(this._db, this.name, mode, resolve, reject);
        return tx.objectStore(this.name);
    }

    get autoIncrement() {
        return this._getRaw().autoIncrement;
    }

    get indexNames() {
        return this._getRaw().indexNames;
    }

    get keyPath() {
        return this._getRaw().keyPath;
    }

    index(name) {
        return new Index(this, name);
    }

    iterate(...args) {
        const objectStore = this._getRaw(); // Defaults to readonly. If you want readwrite, use the Transaction-based API
        return iterate(objectStore, ...args);
    }
}

['add', 'clear', 'count', 'delete', 'get', 'put'].forEach((methodName) => {
    ObjectStore.prototype[methodName] = function (key) {
        return wrapRequest(this._getRaw.bind(this), methodName, key);
    };
});

module.exports = ObjectStore;