const ObjectStore = require('./object-store');

class Transaction {
    constructor(db, storeNames, mode, resolve, reject) {
        this.mode = mode;
        this.db = db;
        this.value = null; // Elsewhere, set to return value of callback

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        this._rawTransaction = db._rawDb.transaction(storeNames, this.mode);

        // If reject and resolve are not provided, it must be some stupid minor internal use from ObjectStore, so whatever
        if (!reject) {
            reject = err => { throw err; };
        }
        if (!resolve) {
            resolve = () => {};
        }

        this._rawTransaction.onabort = event => {
console.log('TRANSACTION ABORT', event.target.error ? event.target.error.name : null);
            if (event.target.error && event.target.error.name === 'QuotaExceededError') {
console.log('TRANSACTION QuotaExceededError');
            } else {
                // QuotaExceededError is the only one we want to propagate to database level
                event.stopPropagation();
                if (event.target.error === null) {
                    // Transaction is manually aborted, should not reject then
                    resolve();
                } else {
                    reject(event.target.error);
                }
            }
        };
        this._rawTransaction.onerror = event => {
console.log('TRANSACTION ERROR', event.target.error.name);
            reject(event.target.error);
        };
        this._rawTransaction.oncomplete = () => {
            resolve(this.value);
        };

        storeNames.forEach(name => {
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
}

module.exports = Transaction;