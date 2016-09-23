import arrayUnique from 'array-unique';
import backboard from './backboard';
import Emitter from './Emitter';
import ObjectStore from './ObjectStore';
import Transaction from './Transaction';

let reservedNames;

class DB extends Emitter {
    constructor(rawDb, tx) {
        super(['versionchange']);

        this._rawDb = rawDb;
        this.name = rawDb.name;
        this.version = rawDb.version;

        rawDb.onabort = event => {
            if (!event.target.error) {
                // This should never happen, because this shouldn't bubble.
                console.log('Unexpected database-level abort event with no error');
                return;
            }

            if (event.target.error.name === 'QuotaExceededError') {
                backboard._emit('quotaexceeded', event);
            } else {
                // This should never happen, because this shouldn't bubble.
                console.log('Unexpected database-level abort event', event);
                throw event.target.error;
            }
        };
        rawDb.onerror = event => {
            console.log('Unexpected database-level error event');
            throw event.target.error;
        };
        rawDb.onversionchange = event => {
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

    close() {
        this._rawDb.close();
    }

    tx(storeNames, mode, cb) {
        if (cb === undefined && typeof mode === 'function') {
            cb = mode;
            mode = 'readonly';
        }
        mode = mode !== undefined ? mode : 'readonly';

        return new backboard.Promise((resolve, reject) => {
            const rawTx = this._rawDb.transaction(storeNames, mode);
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