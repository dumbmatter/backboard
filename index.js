'use strict';

var upgrade = require('./lib/upgrade');
var DB = require('./lib/DB');

class Backboard {
    static open(name, schemas) {
        return new Promise(function (resolve, reject) {
            const latestSchema = schemas[schemas.length - 1];

            const request = indexedDB.open(name, latestSchema.version);
            request.onerror = (event) => reject(event.target.error);
            request.onblocked = () => reject(new Error('Unexpected blocked event'));
            request.onupgradeneeded = (event) => upgrade(event, schemas);
            request.onsuccess = (event) => resolve(new DB(event.target.result));
        });
    }

    static delete(name) {
        return new Promise(function (resolve, reject) {
            const request = indexedDB.deleteDatabase(name);
            request.onerror = (event) => reject(event.target.error);
            request.onblocked = () => resolve(); // http://stackoverflow.com/a/27871590/786644
            request.onupgradeneeded = (event) => reject(new Error('Unexpected upgradeneeded event'));
            request.onsuccess = () => resolve();
        });
    }
}

module.exports = Backboard;