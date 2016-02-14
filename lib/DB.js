import arrayUnique from 'array-unique';
import Backboard from './Backboard';
import ObjectStore from './ObjectStore';
import Transaction from './Transaction';

let reservedNames;

class DB {
    constructor(rawDb, tx) {
        this._rawDb = rawDb;
        this.name = rawDb.name;
        this.version = rawDb.version;

        this.listeners = {};
        this.validListenerNames = ['quotaexceeded', 'versionchange'];

        rawDb.onabort = event => {
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
        rawDb.onerror = event => {
console.log('DB ERROR');
            console.log('Unexpected database-level error event');
            throw event.target.error;
        };
        rawDb.onversionchange = event => {
console.log('DB VERSIONCHANGE');
            this._emit('versionchange', event);
        };

        // If tx was passed (UpgradeDB), use that transaction everywhere. Otherwise, pass db and create a new trasnaction for each request.
        this._dbOrTx = tx ? tx : this;
        for (let i = 0; i < rawDb.objectStoreNames.length; i++) {
            const name = rawDb.objectStoreNames[i];
            if (reservedNames.indexOf(name) < 0) {
                this[name] = new ObjectStore(this._dbOrTx, name);
            } else {
                throw new Error('Backboard cannot support an object store named "' + name + '" due to a name collision with a built-in property');
            }
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

    tx(storeNames, mode, tx0, cb) {
        if (cb === undefined && typeof tx0 === 'function') {
            cb = tx0;
            if (typeof mode === 'string') {
                tx0 = null;
            } else {
                tx0 = mode;
                mode = 'readonly';
            }
        }
        if (cb === undefined && tx0 === undefined && typeof mode === 'function') {
            cb = mode;
            tx0 = null;
            mode = 'readonly';
        }
        mode = mode !== undefined ? mode : 'readonly'; // Set default value, because some people reported errors when this was undefined
        tx0 = tx0 !== undefined ? tx0 : null;
        cb = cb !== undefined ? cb : () => {};

        return new Backboard.Promise((resolve, reject) => {
            const rawTx = tx0 !== null ? tx0._rawTransaction : this._rawDb.transaction(storeNames, mode);
            const tx = new Transaction(this, storeNames, rawTx, resolve, reject);
            tx.value = cb(tx);
        });
    }

    get objectStoreNames() {
        return this._rawDb.objectStoreNames;
    }

    createObjectStore(name, options) {
        if (reservedNames.indexOf(name) < 0) {
            this._rawDb.createObjectStore.call(this._rawDb, name, options);
            this[name] = new ObjectStore(this._dbOrTx, name);
            return this[name];
        } else {
            throw new Error('Backboard cannot support an object store named "' + name + '" due to a name collision with a built-in property');
        }
    }

    deleteObjectStore(name) {
        this._rawDb.deleteObjectStore.call(this._rawDb, name);
        delete this[name];
    }
}

// Define after DB, but use later inside DB
reservedNames = arrayUnique([]
    .concat(Object.getOwnPropertyNames(DB.prototype))
    .concat(Object.getOwnPropertyNames(Transaction.prototype)));

export default DB;