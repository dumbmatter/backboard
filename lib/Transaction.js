import ObjectStore from './ObjectStore';

class Transaction {
    constructor(db, storeNames, rawTx, resolve, reject) {
        this.mode = rawTx.mode;
        this.db = db;
        this.value = null; // Elsewhere, set to return value of callback

        storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];

        // If reject and resolve are not provided, it must be some stupid minor internal use from ObjectStore, so whatever
        if (!reject) {
            reject = err => { throw err; };
        }
        if (!resolve) {
            resolve = () => {};
        }

        this._rawTransaction = rawTx;
        this._rawTransaction.onabort = event => {
            if (event.target.error && event.target.error.name === 'QuotaExceededError') {
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

    _rawObjectStore(name) {
        return this._rawTransaction.objectStore(name);
    }

    abort() {
        this._rawTransaction.abort();
    }
}

export default Transaction;