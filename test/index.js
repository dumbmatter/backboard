const assert = require('assert');
GLOBAL.indexedDB = require('fake-indexeddb');
const Backboard = require('..');

const schemas = [{
    version: 1,
    objectStores: {
        players: {
            options: {keyPath: 'pid', autoIncrement: true},
            indexes: {
                tid: {keyPath: 'tid'}
            }
        },
        teams: {
            options: {keyPath: 'pid', autoIncrement: true},
            indexes: {
                tid: {keyPath: 'tid', unique: true}
            }
        }
    }
}];

describe('Backboard.open', () => {
    afterEach(function () {
        return Backboard.delete('test');
    });

    it('should create object stores', () => {
        return Backboard.open('test', schemas)
            .then(function (db) {
                db.close();
            });
    });

    describe('Schema upgrades', () => {
        beforeEach(function () {
            return Backboard.open('test', schemas)
                .then(function (db) {
                    db.close();
                });
        });

        it('should create new object store', () => {
            const newSchemas = schemas.concat({
                version: 2,
                objectStores: {
                    players: {
                        options: {keyPath: 'pid', autoIncrement: true},
                        indexes: {
                            tid: {keyPath: 'tid'}
                        }
                    },
                    teams: {
                        options: {keyPath: 'pid', autoIncrement: true},
                        indexes: {
                            tid: {keyPath: 'tid', unique: true}
                        }
                    },
                    games: {
                        options: {keyPath: 'gid', autoIncrement: true}
                    }
                }
            });

            return Backboard.open('test', newSchemas)
                .then(function (db) {
                    assert.deepEqual(db.objectStoreNames.sort(), ['games', 'players', 'teams']);
                    db.close();
                });
        });

        it('should delete obsolete object store', () => {
            const newSchemas = schemas.concat({
                version: 2,
                objectStores: {
                    players: {
                        options: {keyPath: 'pid', autoIncrement: true},
                        indexes: {
                            tid: {keyPath: 'tid'}
                        }
                    }
                }
            });

            return Backboard.open('test', newSchemas)
                .then(function (db) {
                    assert.deepEqual(db.objectStoreNames.sort(), ['players']);
                    db.close();
                });
        });

        it('should create new index', () => {
            const newSchemas = schemas.concat({
                version: 2,
                objectStores: {
                    players: {
                        options: {keyPath: 'pid', autoIncrement: true},
                        indexes: {
                            tid: {keyPath: 'tid'}
                        }
                    },
                    teams: {
                        options: {keyPath: 'pid', autoIncrement: true},
                        indexes: {
                            tid: {keyPath: 'tid', unique: true},
                            foo: {keyPath: 'foo', unique: true}
                        }
                    }
                }
            });

            return Backboard.open('test', newSchemas)
                .then(function (db) {
                    assert.deepEqual(db.teams.indexNames.sort(), ['foo', 'tid']);
                    db.close();
                });
        });

        it('should delete obsolete index', () => {
            const newSchemas = schemas.concat({
                version: 2,
                objectStores: {
                    players: {
                        options: {keyPath: 'pid', autoIncrement: true},
                        indexes: {
                            tid: {keyPath: 'tid'}
                        }
                    },
                    teams: {
                        options: {keyPath: 'pid', autoIncrement: true}
                    }
                }
            });

            return Backboard.open('test', newSchemas)
                .then(function (db) {
                    assert.deepEqual(db.teams.indexNames, []);
                    db.close();
                });
        });

        it('should recreate index if options change');
        it('should run upgradeFunction if present');
    })
});