import DB from './DB';
import Index from './Index';
import Transaction from './Transaction';
import iterate from './iterate';
import wrapRequest from './wrap-request';

class ObjectStore {
    constructor(dbOrTransaction, name) {
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

        const rawTx = this._db._rawDb.transaction(this.name, mode);
        const tx = new Transaction(this._db, this.name, rawTx, resolve, reject);
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

    createIndex(...args) {
        return this._getRaw().createIndex(...args);
    }

    deleteIndex(...args) {
        return this._getRaw().deleteIndex(...args);
    }

    index(name) {
        return new Index(this, name);
    }

    iterate(...args) {
        const objectStore = this._getRaw(); // Defaults to readonly. If you want readwrite, use the Transaction-based API
        return iterate(objectStore, ...args);
    }
}

['add', 'clear', 'count', 'delete', 'get', 'getAll', 'put'].forEach(methodName => {
    ObjectStore.prototype[methodName] = function (...args) {
        return wrapRequest(this._getRaw.bind(this), methodName, ...args);
    };
});

export default ObjectStore;