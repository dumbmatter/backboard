import DB from './lib/db';
import Transaction from './lib/transaction';
import UpgradeDB from './lib/upgrade-db';

class Backboard {
    static open(name, version, upgradeCallback) {
        return new Backboard.Promise((resolve, reject) => {
            const request = indexedDB.open(name, version);
            request.onerror = event => reject(event.target.error);
            request.onblocked = () => reject(new Error('Unexpected blocked event'));
            request.onupgradeneeded = event => {
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;
                const upgradeDB = new UpgradeDB(event.target.result, event.oldVersion);
                const tx = new Transaction(upgradeDB, upgradeDB.objectStoreNames, event.currentTarget.transaction);

                upgradeCallback(upgradeDB, tx)
            };
            request.onsuccess = event => resolve(new DB(event.target.result));
        });
    }

    static delete(name) {
        return new Backboard.Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = event => reject(event.target.error);
            request.onblocked = () => resolve(); // http://stackoverflow.com/a/27871590/786644
            request.onupgradeneeded = () => reject(new Error('Unexpected upgradeneeded event'));
            request.onsuccess = () => resolve();
        });
    }

    static setPromiseConstructor(PromiseConstructor) {
        Backboard.Promise = PromiseConstructor;
    }
}

['lowerBound', 'upperBound', 'only', 'bound'].forEach((keyRangeFunction) => {
    Backboard[keyRangeFunction] = (...args) => IDBKeyRange.lowerBound.apply(IDBKeyRange, args);
});

Backboard.Promise = Promise;

export default Backboard;