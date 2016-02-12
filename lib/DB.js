import Backboard from '..';
import ObjectStore from './ObjectStore';
import Transaction from './Transaction';

class DB {
    constructor(rawDb) {
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

        for (let i = 0; i < rawDb.objectStoreNames.length; i++) {
            this[rawDb.objectStoreNames[i]] = new ObjectStore(this, rawDb.objectStoreNames[i]);
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
            const rawTx = this._rawDb.transaction(storeNames, mode);
            const tx = new Transaction(this, storeNames, rawTx, resolve, reject);
            tx.value = cb(tx);
        });
    }

    get objectStoreNames() {
        return this._rawDb.objectStoreNames;
    }

    get createObjectStore() {
        return this._rawDb.createObjectStore.bind(this._rawDb);
    }

    get deleteObjectStore() {
        return this._rawDb.deleteObjectStore.bind(this._rawDb);
    }
}

export default DB;