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

describe('Index', () => {
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

    describe('get', () => {
        it('should allow query by index', () => {
            return db.players.add(player)
                .then(() => db.players.index('tid').get(1))
                .then((playerFromDb) => assert.deepEqual(playerFromDb, player));
        });

        it('should return undefined if no matching key', () => {
            return db.players.add(player)
                .then(() => db.players.index('tid').get(2))
                .then((playerFromDb) => assert.equal(playerFromDb, undefined));
        });
    });

    describe('count', () => {
        it('should count all records in index', () => {
            return db.players.add(player)
                .then(() => {
                    player.pid = 5;
                    return db.players.add(player);
                })
                .then(() => db.players.index('tid').count(1))
                .then((numPlayers) => assert.equal(numPlayers, 2));
        });
    });

    describe('iterate', () => {
        beforeEach(() => {
            return db.players.add(player)
                .then(() => {
                    player.pid = 5;
                    player.tid = 2;
                    return db.players.add(player);
                })
                .then(() => {
                    player.pid = 6;
                    player.tid = 3;
                    return db.players.add(player);
                })
                .then(() => {
                    player.pid = 7;
                    player.tid = 4;
                    return db.players.add(player);
                })
                .then(() => {
                    player.pid = 8;
                    player.tid = 5;
                    return db.players.add(player);
                });
        });

        it('should iterate over all records in store', () => {
            let count = 0;
            const tids = [1, 2, 3, 4, 5];
            return db.players.index('tid')
                .iterate((player) => {
                    assert.equal(player.tid, tids[count]);
                    count++;
                })
                .then(() => assert.equal(count, tids.length));
        });

        it('should iterate over all records in store in reverse', () => {
            let count = 0;
            const tids = [5, 4, 3, 2, 1];
            return db.players.index('tid')
                .iterate('prev', (player) => {
                    assert.equal(player.tid, tids[count]);
                    count++;
                })
                .then(() => assert.equal(count, tids.length));
        });

        it('should iterate over records starting with key', () => {
            let count = 0;
            const tids = [3, 4, 5];
            return db.players.index('tid')
                .iterate(Backboard.lowerBound(3), (player) => {
                    assert.equal(player.tid, tids[count]);
                    count++;
                })
                .then(() => assert.equal(count, tids.length));
        });

        it('should short circuit', () => {
            let count = 0;
            return db.players.index('tid')
                .iterate((player, shortCircuit) => {
                    shortCircuit();
                    count++;
                })
                .then(() => assert.equal(count, 1));
        });

        it('should update when callback returns an object', () => {
            const tx = db.tx('players', 'readwrite');
            return tx.players.index('tid')
                .iterate(3, (player) => {
                    player.updated = true;
                    return player;
                })
                .then(() => tx.players.index('tid').get(3))
                .then((player) => assert.equal(player.updated, true));
        });

        it('should update when callback resolves to an object', () => {
            const tx = db.tx('players', 'readwrite');
            return tx.players.index('tid')
                .iterate(3, (player) => {
                    player.updated = true;
                    return Backboard.Promise.resolve(player);
                })
                .then(() => tx.players.index('tid').get(3))
                .then((player) => assert.equal(player.updated, true));
        });

        it('should advance over multiple records', () => {
            let count = 0;
            const tids = [5, 4, 1];
            return db.players.index('tid')
                .iterate('prev', (player, shortCircuit, advance) => {
                    assert.equal(player.tid, tids[count]);
                    if (count === 1) {
                        advance(3);
                    }
                    count++;
                })
                .then(() => assert.equal(count, tids.length));
        });
    });
});