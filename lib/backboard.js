import DB from './DB';
import Emitter from './Emitter';
import Transaction from './Transaction';
import UpgradeDB from './UpgradeDB';

class Backboard extends Emitter {
    constructor() {
        super(['blocked', 'quotaexceeded']);
    }

    open(name, version, upgradeCallback) {
        return new this.Promise((resolve, reject) => {
            const request = indexedDB.open(name, version);
            request.onerror = event => reject(event.target.error);
            request.onblocked = event => this._emit('blocked', event);
            request.onupgradeneeded = event => {
                const rawDB = event.target.result;
                const tx = new Transaction(rawDB, [...rawDB.objectStoreNames], event.currentTarget.transaction);
                const upgradeDB = new UpgradeDB(rawDB, tx, event.oldVersion);

                try {
                    upgradeCallback(upgradeDB);
                } catch (err) {
                    tx.abort();
                    rawDB.close();
                    reject(err);
                }
            };
            request.onsuccess = event => {
                const rawDB = event.target.result;
                try {
                    const db = new DB(rawDB);
                    resolve(db);
                } catch (err) {
                    rawDB.close();
                    reject(err);
                }
            };
        });
    }

    delete(name) {
        return new this.Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = event => reject(event.target.error);
            request.onblocked = () => resolve(); // http://stackoverflow.com/a/27871590/786644
            request.onupgradeneeded = () => reject(new Error('Unexpected upgradeneeded event'));
            request.onsuccess = () => resolve();
        });
    }

    setPromiseConstructor(PromiseConstructor) {
        this.Promise = PromiseConstructor;
    }
}

['lowerBound', 'upperBound', 'only', 'bound'].forEach(keyRangeFunction => {
    Backboard.prototype[keyRangeFunction] = (...args) => IDBKeyRange[keyRangeFunction].apply(IDBKeyRange, args);
});

if (typeof Promise !== 'undefined') {
    Backboard.prototype.Promise = Promise;
}

export default new Backboard();