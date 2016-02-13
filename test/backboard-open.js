import assert from 'assert';
import Backboard from '..';

describe('Backboard.open', () => {
    afterEach(() => {
        return Backboard.delete('test');
    });

    it('should create object stores', () => {
        return Backboard.open('test', 1, upgradeDB => {
                const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                playerStore.createIndex('tid', 'tid');

                upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
            })
            .then(db => {
                assert.deepEqual([...db.objectStoreNames].sort(), ['players', 'teams']);

                db.close();
            });
    });

    it('should allow access of newly-created stores on upgradeDB', () => {
        return Backboard.open('test', 1, upgradeDB => {
                upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});

                upgradeDB.players.put({pid: 2, name: 'Bob'})
                    .then(() => upgradeDB.players.get(2))
                    .then((player) => assert.equal(player.name, 'Bob'));
            })
            .then(db => db.close());
    });

    it('should remove access to deleted stores on upgradeDB', () => {
        return Backboard.open('test', 1, upgradeDB => {
                upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                assert.equal(upgradeDB.hasOwnProperty('players'), true);

                upgradeDB.deleteObjectStore('players');
                assert.equal(upgradeDB.hasOwnProperty('players'), false);
            })
            .then(db => db.close());
    });

    describe('object store name collisions', () => {
        it('should error createObjectStore is called with the same name as a Backboard DB or Transaction property');

        it('should error when used with a database with a the same name as a Backboard DB or Transaction property');
    });

    describe('Schema upgrades', () => {
        beforeEach(() => {
            return Backboard.open('test', 1, upgradeDB => {
                    const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                    playerStore.createIndex('tid', 'tid');

                    upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
                })
                .then(db => db.close());
        });

        it('should create new object store', () => {
            return Backboard.open('test', 2, upgradeDB => {
                    upgradeDB.createObjectStore('games');
                })
                .then(db => {
                    assert.deepEqual([...db.objectStoreNames].sort(), ['games', 'players', 'teams']);
                    db.close();
                });
        });

        it('should delete obsolete object store', () => {
            return Backboard.open('test', 2, upgradeDB => {
                    upgradeDB.deleteObjectStore('teams');
                })
                .then(db => {
                    assert.deepEqual([...db.objectStoreNames].sort(), ['players']);
                    db.close();
                });
        });

        it('should create new index', () => {
            return Backboard.open('test', 2, upgradeDB => {
                    upgradeDB.teams.createIndex('foo', 'foo', {unique: true});
                })
                .then(db => {
                    assert.deepEqual([...db.teams.indexNames].sort(), ['foo']);
                    db.close();
                });
        });

        it('should delete obsolete index', () => {
            return Backboard.open('test', 2, upgradeDB => {
                    upgradeDB.players.deleteIndex('tid');
                })
                .then(db => {
                    assert.equal(db.players.indexNames.length, 0);
                    db.close();
                });
        });

        it('should gracefully handle upgrades when multiple database connections are open', () => {
            return Backboard.open('test', 1)
                .then(db => {
                    assert.equal(db.version, 1);

                    let versionchangeCount = 0;

                    db.on('versionchange', () => {
                        versionchangeCount += 1;
                        db.close();
                    });

                    return Backboard.open('test', 2, upgradeDB => {
                            upgradeDB.deleteObjectStore('teams');
                        })
                        .then(db2 => {
                            assert.equal(db2.version, 2);
                            db2.close();
                        })
                        .then(() => assert.equal(versionchangeCount, 1));
                });
        });
    });
});