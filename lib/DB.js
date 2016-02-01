'use strict';

class ObjectStore {
    constructor(dbOrTransaction, name) {
        if (dbOrTransaction instanceof DB) {
            this._db = dbOrTransaction;
        } else if (dbOrTransaction instanceof Transaction) {
            this._rawObjectStore = dbOrTransaction.objectStore(name);
        }
        this._name = name;
    }

    _getRaw(mode) {
        if (this._rawObjectStore) {
            return this._rawObjectStore;
        }

        return this._db.tx(this._name, mode).objectStore(this._name);
    }

    _wrapRequest(method, argument) {
        return new Promise((resolve, reject) => {
            const request = this._getRaw("readwrite")[method](argument);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    get indexNames() {
        return this._getRaw().indexNames;
    }

    add(value) {
        return this._wrapRequest('add', value);
    }

    put(value) {
        return this._wrapRequest('put', value);
    }

    get(key) {
        return this._wrapRequest('get', key);
    }
}

class Transaction {
    constructor(db, storeNames, mode) {
        // Default value, because some people reported errors when this was undefined
        mode = mode !== undefined ? mode : "readonly";

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        this._rawTransaction = db._rawDb.transaction(storeNames, mode);

        this._rawTransaction.complete = () => {
            return new Promise((resolve) => {
                this._rawTransaction.oncomplete = function () {
                    resolve();
                };
            });
        };

        storeNames.forEach((name) => {
            this[name] = new ObjectStore(this, name);
        });

        return this;
    }

    objectStore(name) {
        return this._rawTransaction.objectStore(name);
    }
}

class DB {
    constructor(db) {
        this._rawDb = db;

        db.objectStoreNames.forEach((name) => {
            this[name] = new ObjectStore(this, name);
        });
    }

    close() {
        this._rawDb.close();
    }

    tx(storeNames, mode) {
        return new Transaction(this, storeNames, mode);
    }

    get objectStoreNames() {
        return this._rawDb.objectStoreNames;
    }
}


module.exports = DB;