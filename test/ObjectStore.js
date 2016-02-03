'use strict';

const assert = require('assert');
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

let db, player;

describe('ObjectStore', () => {
    beforeEach(() => {
        player = {
            pid: 4,
            tid: 1,
            name: 'John Smith'
        };

        return Backboard.open('test', schemas)
            .then((dbLocal) => {
                db = dbLocal;
            });
    });

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
                .then((playerFromDb) => assert.deepEqual(playerFromDb, player));
        });

        it('should error on key collision', () => {
            return db.players.add(player)
                .then((key) => {
                    assert.equal(key, 4);
                    return db.players.add(player);
                })
                .then(assert.fail)
                .catch((err) => assert.equal(err.name, 'ConstraintError'));
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
                .then((playerFromDb) => assert.deepEqual(playerFromDb, player));
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
                .then((playerFromDb) => assert.equal(playerFromDb.name, 'Updated'));
        });
    });

    describe('clear', () => {
        it('should delete all records in store', () => {
            return db.players.add(player)
                .then(() => {
                    player.pid = 5;
                    return db.players.add(player);
                })
                .then(() => db.players.clear())
                .then(() => db.players.count(Backboard.lowerBound(0)))
                .then((numPlayers) => assert.equal(numPlayers, 0));
        });
    });

    describe('count', () => {
        it('should count all records in store', () => {
            return db.players.add(player)
                .then(() => {
                    player.pid = 5;
                    return db.players.add(player);
                })
                .then(() => db.players.count(Backboard.lowerBound(0)))
                .then((numPlayers) => assert.equal(numPlayers, 2));
        });
    });

    describe('delete', () => {
        it('should delete record', () => {
            return db.players.add(player)
                .then(() => {
                    player.pid = 5;
                    return db.players.add(player);
                })
                .then(() => db.players.delete(4))
                .then(() => db.players.count(Backboard.lowerBound(0)))
                .then((numPlayers) => {
                    assert.equal(numPlayers, 1);

                    return db.players.get(5);
                })
                .then((playerFromDb) => assert.deepEqual(playerFromDb, player));
        });
    });

    describe('iterate', () => {
        beforeEach(() => {
            return db.players.add(player)
                .then(() => {
                    player.pid = 5;
                    return db.players.add(player);
                })
                .then(() => {
                    player.pid = 6;
                    return db.players.add(player);
                })
                .then(() => {
                    player.pid = 7;
                    return db.players.add(player);
                })
                .then(() => {
                    player.pid = 8;
                    return db.players.add(player);
                });
        });

        it('should iterate over all records in store', () => {
            let count = 0;
            const pids = [4, 5, 6, 7, 8];
            return db.players
                .iterate((player) => {
                    assert.equal(player.pid, pids[count]);
                    count++;
                })
                .then(() => assert.equal(count, pids.length));
        });

        it('should iterate over all records in store in reverse', () => {
            let count = 0;
            const pids = [8, 7, 6, 5, 4];
            return db.players
                .iterate('prev', (player) => {
                    assert.equal(player.pid, pids[count]);
                    count++;
                })
                .then(() => assert.equal(count, pids.length));
        });

        it('should iterate over records starting with key', () => {
            let count = 0;
            const pids = [6, 7, 8];
            return db.players
                .iterate(Backboard.lowerBound(6), (player) => {
                    assert.equal(player.pid, pids[count]);
                    count++;
                })
                .then(() => assert.equal(count, pids.length));
        });

        it('should short circuit', () => {
            let count = 0;
            return db.players
                .iterate((player, shortCircuit) => {
                    shortCircuit();
                    count++;
                })
                .then(() => assert.equal(count, 1));
        });

        it('should update when callback returns an object', () => {
            const tx = db.tx('players', 'readwrite');
            return tx.players
                .iterate(6, (player) => {
                    player.updated = true;
                    return player;
                })
                .then(() => tx.players.get(6))
                .then((player) => assert.equal(player.updated, true));
        });

        it('should update when callback resolves to an object', () => {
            const tx = db.tx('players', 'readwrite');
            return tx.players
                .iterate(6, (player) => {
                    player.updated = true;
                    return Promise.resolve(player);
                })
                .then(() => tx.players.get(6))
                .then((player) => assert.equal(player.updated, true));
        });

        it('should advance over multiple records', () => {
            let count = 0;
            const pids = [8, 7, 4];
            return db.players
                .iterate('prev', (player, shortCircuit, advance) => {
                    assert.equal(player.pid, pids[count]);
                    if (count === 1) {
                        advance(3);
                    }
                    count++;
                })
                .then(() => assert.equal(count, pids.length));
        });
    });
});