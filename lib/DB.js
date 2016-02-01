'use strict';

class Index {
    constructor(rawObjectStore, name) {
        this._rawObjectStore = rawObjectStore;
        this._name = name;
        this._rawIndex = this._rawObjectStore.index(name);
    }

    _wrapRequest(method, argument) {
        return new Promise((resolve, reject) => {
            const request = this._rawIndex[method](argument);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    count(key) {
        return this._wrapRequest('count', key);
    }

    get(key) {
        return this._wrapRequest('get', key);
    }
}

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
            const readwriteRequired = ['add', 'clear', 'delete', 'put'];
            const mode = readwriteRequired.indexOf(method) >= 0 ? 'readwrite' : undefined;

            const request = this._getRaw(mode)[method](argument);
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    get indexNames() {
        return this._getRaw().indexNames;
    }

    index(name) {
        return new Index(this._getRaw(), name);
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

    iterate(options) {
        options = options !== undefined ? options : {};
        options.key = options.hasOwnProperty('key') ? options.key : null;
        options.direction = options.hasOwnProperty('direction') ? options.direction : 'next';
        options.callback = options.hasOwnProperty('callback') ? options.callback : null;

        return new Promise((resolve, reject) => {
            // Defaults to readonly. If you want readwrite, use the Transaction-based API
            const objectStore = this._getRaw();

            const request = objectStore.openCursor(options.key, options.direction);
            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor) {
                    if (options.callback !== null) {
                        let shortCircuit = false;
                        let advance = null;

                        const shortCircuitFunction = () => {
                            shortCircuit = true;
                        };
                        const advanceFunction = (count) => {
                            advance = count;
                        };

                        const callbackResult = options.callback(cursor.value, shortCircuitFunction, advanceFunction);

                        // Return a promise: waits until resolved to continue
                        // Return a value: immediately continue
                        // Return or resolve to undefined: no update (otherwise update)
                        Promise.resolve(callbackResult)
                            .then((updatedValue) => {
                                // Only update if return value is not undefined
                                if (updatedValue !== undefined) {
                                    cursor.update(updatedValue);
                                }

                                // Allow short circuiting
                                if (shortCircuit) {
                                    resolve();
                                } else if (advance !== null) {
                                    cursor.advance(advance);
                                } else {
                                    cursor.continue();
                                }
                            })
                            .catch(reject);
                    }
                } else {
                    resolve();
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

class Transaction {
    constructor(db, storeNames, mode) {
        // Default value, because some people reported errors when this was undefined
        mode = mode !== undefined ? mode : 'readonly';

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        this._rawTransaction = db._rawDb.transaction(storeNames, mode);

        storeNames.forEach((name) => {
            this[name] = new ObjectStore(this, name);
        });

        return this;
    }

    objectStore(name) {
        return this._rawTransaction.objectStore(name);
    }

    complete() {
        return new Promise((resolve) => {
            this._rawTransaction.oncomplete = () => resolve();
        });
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