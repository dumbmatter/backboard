const upgrade = require('./lib/upgrade');
const DB = require('./lib/DB');

class Backboard {
    static open(name, schemas) {
        return new Backboard.Promise((resolve, reject) => {
            const latestSchema = schemas[schemas.length - 1];

            const request = indexedDB.open(name, latestSchema.version);
            request.onerror = (event) => reject(event.target.error);
            request.onblocked = () => reject(new Error('Unexpected blocked event'));
            request.onupgradeneeded = (event) => upgrade(event, schemas);
            request.onsuccess = (event) => resolve(new DB(event.target.result));
        });
    }

    static delete(name) {
        return new Backboard.Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = (event) => reject(event.target.error);
            request.onblocked = () => resolve(); // http://stackoverflow.com/a/27871590/786644
            request.onupgradeneeded = () => reject(new Error('Unexpected upgradeneeded event'));
            request.onsuccess = () => resolve();
        });
    }

    static setPromiseConstructor(PromiseConstructor) {
        Backboard.Promise = PromiseConstructor;
    }

    static lowerBound() {
        return IDBKeyRange.lowerBound.apply(IDBKeyRange, arguments);
    }
    static upperBound() {
        return IDBKeyRange.upperBound.apply(IDBKeyRange, arguments);
    }
    static only() {
        return IDBKeyRange.only.apply(IDBKeyRange, arguments);
    }
    static bound() {
        return IDBKeyRange.bound.apply(IDBKeyRange, arguments);
    }
}
Backboard.Promise = Promise;

module.exports = Backboard;