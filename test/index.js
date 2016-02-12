import assert from 'assert';
import Backboard from '..';

let db, player;

describe('Index', () => {
    beforeEach(() => {
        player = {
            pid: 4,
            tid: 1,
            name: 'John Smith'
        };

        return Backboard.open('test', 1, upgradeDB => {
                const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                playerStore.createIndex('tid', 'tid');

                const teamStore = upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
                teamStore.createIndex('tid', 'tid', {unique: true});
            })
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
                .then(playerFromDb => assert.deepEqual(playerFromDb, player));
        });

        it('should return undefined if no matching key', () => {
            return db.players.add(player)
                .then(() => db.players.index('tid').get(2))
                .then(playerFromDb => assert.equal(playerFromDb, undefined));
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
                .then(numPlayers => assert.equal(numPlayers, 2));
        });
    });

    describe('getAll', () => {
        beforeEach(function () {
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
                    player.tid = 2;
                    return db.players.add(player);
                });
        });

        it('should get all records', () => {
            return db.players.index('tid').getAll()
                .then(players => {
                    assert.equal(players.length, 4);
                });
        });

        it('should work with query parameter', () => {
            return db.players.index('tid').getAll(1)
                .then(players => {
                    assert.equal(players.length, 3);
                    assert.equal(players[0].pid, 4);
                    assert.equal(players[1].pid, 5);
                    assert.equal(players[2].pid, 6);
                });
        });

        it('should work with query and count parameters', () => {
            return db.players.index('tid').getAll(null, 2)
                .then(players => {
                    assert.equal(players.length, 2);
                    assert.equal(players[0].pid, 4);
                    assert.equal(players[1].pid, 5);
                });
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
                .iterate(player => {
                    assert.equal(player.tid, tids[count]);
                    count++;
                })
                .then(() => assert.equal(count, tids.length));
        });

        it('should iterate over all records in store in reverse', () => {
            let count = 0;
            const tids = [5, 4, 3, 2, 1];
            return db.players.index('tid')
                .iterate('prev', player => {
                    assert.equal(player.tid, tids[count]);
                    count++;
                })
                .then(() => assert.equal(count, tids.length));
        });

        it('should iterate over records starting with key', () => {
            let count = 0;
            const tids = [3, 4, 5];
            return db.players.index('tid')
                .iterate(Backboard.lowerBound(3), player => {
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
            return db.tx('players', 'readwrite', (tx) => {
                return tx.players.index('tid')
                    .iterate(3, player => {
                        player.updated = true;
                        return player;
                    })
                    .then(() => tx.players.index('tid').get(3))
                    .then(player => assert.equal(player.updated, true));
            });
        });

        it('should update when callback resolves to an object', () => {
            return db.tx('players', 'readwrite', (tx) => {
                return tx.players.index('tid')
                    .iterate(3, player => {
                        player.updated = true;
                        return Backboard.Promise.resolve(player);
                    })
                    .then(() => tx.players.index('tid').get(3))
                    .then(player => assert.equal(player.updated, true));
            });
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

    describe('properties', () => {
        it('keyPath', () => {
            assert.equal(db.players.index('tid').keyPath, 'tid');
        });

        it('multiEntry', () => {
            assert.equal(db.players.index('tid').multiEntry, false);
        });

        it('name', () => {
            assert.equal(db.players.index('tid').name, 'tid');
        });

        it('objectStore', () => {
            assert.equal(db.players.index('tid').objectStore.name, 'players');
        });

        it('unique', () => {
            assert.equal(db.players.index('tid').unique, false);
        });
    });
});