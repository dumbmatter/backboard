'use strict';

class ObjectStore {
    constructor(db, name) {
        this._db = db;
        this._name = name;
    }

    get indexNames() {
        return this._db.tx(this._name).objectStore(this._name).indexNames;
    }
}

class DB {
    constructor(db) {
        this._dbRaw = db;

        db.objectStoreNames.forEach((name) => {
            this[name] = new ObjectStore(this, name);
        });
    }

    close() {
        this._dbRaw.close();
    }

    tx(storeNames, mode) {
        // Default value, because some people reported errors when this was undefined
        mode = mode !== undefined ? mode : "readonly";

        const transaction = this._dbRaw.transaction(storeNames, mode);

        transaction.complete = function () {
            return new Promise(function (resolve) {
                transaction.oncomplete = function () {
                    resolve();
                };
            });
        };

        return transaction;
    }

    get objectStoreNames() {
        return this._dbRaw.objectStoreNames;
    }
}


module.exports = DB;