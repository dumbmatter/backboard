let Backboard;
const iterate = require('./iterate');

const abortHandler = (event) => {
console.log('DB abortHandler');
/*    if (!event.target.error) {
        // Transaction was manually aborted in code. This is not an error.
        return;
    }

    // Otherwise it might silently fail in situations like QuotaExceededError unless someone is listening for onabort
    throw event.target.error;*/
};
const errorHandler = (event) => {
console.log('DB errorHandler');
//    throw event.target.error;
};

class Index {
    constructor(objectStore, name) {
        this.objectStore = objectStore;
        this.name = name;
        this._rawIndex = objectStore._getRaw().index(name);
    }

    _wrapRequest(method, argument) {
        return new Backboard.Promise((resolve, reject) => {
            const request = this._rawIndex[method](argument);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                // Error is handled here, no need to propagate to transaction or database level
//                event.stopPropagation();

                reject(event.target.error);
            };
        });
    }

    get keyPath() {
        return this._rawIndex.keyPath;
    }

    get multiEntry() {
        return this._rawIndex.multiEntry;
    }

    get unique() {
        return this._rawIndex.unique;
    }

    count(key) {
        return this._wrapRequest('count', key);
    }

    get(key) {
        return this._wrapRequest('get', key);
    }

    iterate(...args) {
        return iterate(this._rawIndex, ...args);
    }
}

class ObjectStore {
    constructor(dbOrTransaction, name) {
        if (dbOrTransaction instanceof DB) {
            this._db = dbOrTransaction;
        } else if (dbOrTransaction instanceof Transaction) {
            this._rawObjectStore = dbOrTransaction.objectStore(name);
        }
        this.name = name;
    }

    _getRaw(mode) {
        if (this._rawObjectStore) {
            return this._rawObjectStore;
        }

        const tx = new Transaction(this._db, this.name, mode);
        return tx.objectStore(this.name);
    }

    _wrapRequest(method, argument) {
        return new Backboard.Promise((resolve, reject) => {
            const readwriteRequired = ['add', 'clear', 'delete', 'put'];
            const mode = readwriteRequired.indexOf(method) >= 0 ? 'readwrite' : undefined;

            const request = this._getRaw(mode)[method](argument);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                // Error is handled here, no need to propagate to transaction or database level
//                event.stopPropagation();

                reject(event.target.error);
            };
        });
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

    add(value) {
        return this._wrapRequest('add', value);
    }

    clear(key) {
        return this._wrapRequest('clear', key);
    }

    count(key) {
        return this._wrapRequest('count', key);
    }

    delete(key) {
        return this._wrapRequest('delete', key);
    }

    get(key) {
        return this._wrapRequest('get', key);
    }

    put(value) {
        return this._wrapRequest('put', value);
    }

    iterate(...args) {
        const objectStore = this._getRaw(); // Defaults to readonly. If you want readwrite, use the Transaction-based API
        return iterate(objectStore, ...args);
    }
}

class Transaction {
    constructor(db, storeNames, mode, resolve, reject) {
        this.mode = mode;
        this.db = db;
        this.value = null; // Elsewhere, set to return value of callback

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        this._rawTransaction = db._rawDb.transaction(storeNames, this.mode);

        if (reject) {
            this._rawTransaction.onabort = (event) => {
console.log('TRANSACTION ABORT', event.target.error.name);
                if (event.target.error === null) {
                    // Transaction is manually aborted, should not reject then
                    resolve();
                } else {
                    reject(event.target.error);
                }
            };
            this._rawTransaction.onerror = (event) => {
console.log('TRANSACTION ERROR', event.target.error.name);
                reject(event.target.error);
            }
        }
        if (resolve) {
            this._rawTransaction.oncomplete = () => {
console.log('TRANSACTION COMPLETE')
                resolve(this.value);
            };
        }

        storeNames.forEach((name) => {
            this[name] = new ObjectStore(this, name);
        });
    }

    get error() {
        return this._rawTransaction.error;
    }

    objectStore(name) {
        return this._rawTransaction.objectStore(name);
    }

    abort() {
        this._rawTransaction.abort();
    }

    complete() {

    }
}

class DB {
    constructor(db) {
        if (!Backboard) { Backboard = require('..'); }

        this._rawDb = db;
        this.name = db.name;
        this.version = db.version;

        db.onabort = abortHandler;
        db.onerror = errorHandler;
        db.onversionchange = () => {
            // By default, close connection to not block upgrade/delete in another window
            this.close();
            throw new Error('Database connection closed due to version change initiated by other connection');
        };

        for (let i = 0; i < db.objectStoreNames.length; i++) {
            this[db.objectStoreNames[i]] = new ObjectStore(this, db.objectStoreNames[i]);
        }
    }

    close() {
        this._rawDb.close();
    }

    tx(storeNames, mode, cb) {
        if (cb === undefined && typeof mode === 'function') {
            cb = mode;
            mode = 'readonly';
        }
        mode = mode !== undefined ? mode : 'readonly'; // Set default value, because some people reported errors when this was undefined

        return new Backboard.Promise((resolve, reject) => {
            const tx = new Transaction(this, storeNames, mode, resolve, reject);
            tx.value = cb(tx);
        });
    }

    get objectStoreNames() {
        return this._rawDb.objectStoreNames;
    }
}


module.exports = DB;