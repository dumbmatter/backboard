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

var db, player;

describe('ObjectStore', () => {
    beforeEach(() => {
        player = {
            pid: 4,
            tid: 1,
            name: 'John Smith'
        };

        return Backboard.open('test', schemas)
            .then((dbLocal) => {
                db = dbLocal
            });
    })

    afterEach(() => {
        db.close();
        return Backboard.delete('test');
    });

    describe('add (transaction-free API)', () => {
        it('should add a new record to the database', () => {
            return db.players.add(player)
                .then((key) => {
                    assert.equal(key, 4);

                    return db.players.get(4);
                })
                .then((playerFromDb) => {
                    assert.deepEqual(playerFromDb, player);
                });
        });

        it('should error on key collision', () => {
            return db.players.add(player)
                .then((key) => {
                    assert.equal(key, 4);
                    return db.players.add(4);
                })
                .catch((err) => {
                    assert.equal(err.name, 'DataError');
                });
        });
    });

    describe('put (transaction API)', () => {
        it('should add a new record to the database', () => {
            const tx = db.tx('players', 'readwrite');
            return tx.players.put(player)
                .then((key) => {
                    assert.equal(key, 4);
                    return tx.players.get(4);
                })
                .then((playerFromDb) => {
                    assert.deepEqual(playerFromDb, player);
                });
        });

        it('should update record on key collision', () => {
            const tx = db.tx('players', 'readwrite');
            return tx.players.put(player)
                .then((key) => {
                    assert.equal(key, 4);
                    player.name = 'Updated';
                    return tx.players.put(player);
                })
                .then((key) => {
                    assert.equal(key, 4);
                    return tx.players.get(4);
                })
                .then((playerFromDb) => {
                    assert.equal(playerFromDb.name, 'Updated');
                });
        });
    });
});