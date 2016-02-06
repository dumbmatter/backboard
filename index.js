import DB from './lib/db';
import upgrade from './lib/upgrade';

class Backboard {
    static open(name, schemas) {
        return new Backboard.Promise((resolve, reject) => {
            const latestSchema = schemas[schemas.length - 1];

            const request = indexedDB.open(name, latestSchema.version);
            request.onerror = event => reject(event.target.error);
            request.onblocked = () => reject(new Error('Unexpected blocked event'));
            request.onupgradeneeded = event => upgrade(event, schemas);
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