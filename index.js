import DB from './lib/DB';
import Transaction from './lib/Transaction';
import UpgradeDB from './lib/UpgradeDB';

class Backboard {
    static open(name, version, upgradeCallback) {
        return new Backboard.Promise((resolve, reject) => {
            const request = indexedDB.open(name, version);
            request.onerror = event => reject(event.target.error);
            request.onblocked = () => reject(new Error('Unexpected blocked event'));
            request.onupgradeneeded = event => {
                const rawDB = event.target.result;
                const tx = new Transaction(upgradeDB, [...rawDB.objectStoreNames], event.currentTarget.transaction);
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

['lowerBound', 'upperBound', 'only', 'bound'].forEach(keyRangeFunction => {
    Backboard[keyRangeFunction] = (...args) => IDBKeyRange.lowerBound.apply(IDBKeyRange, args);
});

Backboard.Promise = Promise;

export default Backboard;