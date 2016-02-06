const Backboard = require('..');
const ObjectStore = require('./object-store');
const Transaction = require('./transaction');

class DB {
    constructor(db) {
        this._rawDb = db;
        this.name = db.name;
        this.version = db.version;

        this.listeners = {};
        this.validListenerNames = ['quotaexceeded', 'versionchange'];

        db.onabort = event => {
console.log('DB ABORT', event.target.error ? event.target.error.name : null);
            if (!event.target.error) {
                // This should never happen, because this shouldn't bubble.
                console.log('Unexpected database-level abort event with no error');
                return;
            }

            if (event.target.error.name === 'QuotaExceededError') {
console.log('DB QuotaExceededError');
                this._emit('quotaexceeded', event);
            } else {
                // This should never happen, because this shouldn't bubble.
                console.log('Unexpected database-level abort event', event);
                throw event.target.error;
            }
        };
        db.onerror = event => {
console.log('DB ERROR');
            console.log('Unexpected database-level error event');
            throw event.target.error;
        };
        db.onversionchange = event => {
console.log('DB VERSIONCHANGE');
            this._emit('versionchange', event);
        };

        for (let i = 0; i < db.objectStoreNames.length; i++) {
            this[db.objectStoreNames[i]] = new ObjectStore(this, db.objectStoreNames[i]);
        }
    }

    _emit(name, value) {
        if (!this.listeners.hasOwnProperty(name)) {
            return;
        }
        if (this.validListenerNames.indexOf(name) < 0) {
            throw new Error('Invalid listener name "' + name + '"');
        }

        this.listeners[name].forEach(listener => listener(value));
    }

    on(name, cb) {
        if (!this.listeners.hasOwnProperty(name)) {
            this.listeners[name] = [];
        }
        if (this.validListenerNames.indexOf(name) < 0) {
            throw new Error('Invalid listener name "' + name + '"');
        }

        this.listeners[name].push(cb);
    }

    off(name, cb) {
        if (!this.listeners.hasOwnProperty(name)) {
            return;
        }
        if (this.validListenerNames.indexOf(name) < 0) {
            throw new Error('Invalid listener name "' + name + '"');
        }

        this.listeners[name] = this.listeners[name].filter(listener => listener !== cb);
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