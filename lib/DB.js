'use strict';

class DB {
    constructor(db) {
        this._db = db;
    }

    close() {
        this._db.close();
    }

    get objectStoreNames() {
        return this._db.objectStoreNames;
    }
}

module.exports = DB;