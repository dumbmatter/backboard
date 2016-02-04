let Backboard;
const iterate = require('./iterate');

const abortHandler = (event) => {
    if (!event.target.error) {
        // Transaction was manually aborted in code. This is not an error.
        return;
    }

    // Otherwise it might silently fail in situations like QuotaExceededError unless someone is listening for onabort
    throw event.target.error;
};
const errorHandler = (event) => {
    throw event.target.error;
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
                event.stopPropagation();
                event.preventDefault();

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

        return this._db.tx(this.name, mode).objectStore(this.name);
    }

    _wrapRequest(method, argument) {
        return new Backboard.Promise((resolve, reject) => {
            const readwriteRequired = ['add', 'clear', 'delete', 'put'];
            const mode = readwriteRequired.indexOf(method) >= 0 ? 'readwrite' : undefined;

            const request = this._getRaw(mode)[method](argument);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => {
                // Error is handled here, no need to propagate to transaction or database level
                event.stopPropagation();
                event.preventDefault();

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
    constructor(db, storeNames, mode) {
        this.mode = mode !== undefined ? mode : 'readonly'; // Set default value, because some people reported errors when this was undefined
        this.db = db;

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        this._rawTransaction = db._rawDb.transaction(storeNames, this.mode);

        this._rawTransaction.onabort = abortHandler;
        this._rawTransaction.onerror = errorHandler;

        storeNames.forEach((name) => {
            this[name] = new ObjectStore(this, name);
        });

        return this;
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
        return new Backboard.Promise((resolve) => {
            this._rawTransaction.oncomplete = () => resolve();
        });
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

    tx(storeNames, mode) {
        return new Transaction(this, storeNames, mode);
    }

    get objectStoreNames() {
        return this._rawDb.objectStoreNames;
    }
}


module.exports = DB;