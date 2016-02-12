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

    it('should do something if there is an object store with the same name as a Backboard DB or Transaction property');

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
            return Backboard.open('test', 2, (upgradeDB, tx) => {
                    tx.teams.createIndex('foo', 'foo', {unique: true});
                })
                .then(db => {
                    assert.deepEqual([...db.teams.indexNames].sort(), ['foo']);
                    db.close();
                });
        });

        it('should delete obsolete index', () => {
            return Backboard.open('test', 2, (upgradeDB, tx) => {
                    tx.players.deleteIndex('tid');
                })
                .then(db => {
                    assert.equal(db.players.indexNames.length, 0);
                    db.close();
                });
        });

        it('should recreate index if options change'); // How to test this? Need to actually use feature of Index, or read index.multiEntry property (need to expose it first, though)
        it('should run upgradeFunction if present');

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