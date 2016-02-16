import assert from 'assert';
import arrayUnique from 'array-unique';
import backboard from '../index';
import DB from '../lib/DB';
import Transaction from '../lib/Transaction';

describe('backboard.open', () => {
    afterEach(() => {
        return backboard.delete('test');
    });

    it('should create object stores', () => {
        return backboard.open('test', 1, upgradeDB => {
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
        return backboard.open('test', 1, upgradeDB => {
                upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});

                upgradeDB.players.put({pid: 2, name: 'Bob'})
                    .then(() => upgradeDB.players.get(2))
                    .then((player) => assert.equal(player.name, 'Bob'));
            })
            .then(db => db.close());
    });

    it('should remove access to deleted stores on upgradeDB', () => {
        return backboard.open('test', 1, upgradeDB => {
                upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                assert.equal(upgradeDB.hasOwnProperty('players'), true);

                upgradeDB.deleteObjectStore('players');
                assert.equal(upgradeDB.hasOwnProperty('players'), false);
            })
            .then(db => db.close());
    });

    describe('object store with same name as a backboard DB or Transaction property', () => {
        const reservedNames = arrayUnique([]
            .concat(Object.getOwnPropertyNames(DB.prototype))
            .concat(Object.getOwnPropertyNames(Transaction.prototype)));

        reservedNames.forEach(name => {
            it('should error when createObjectStore is called with "' + name + '"', () => {
                return backboard.open('test', 1, upgradeDB => {
                        upgradeDB.createObjectStore(name, {keyPath: 'key'});
                    })
                    .then(assert.fail)
                    .catch(err => assert.equal(err.message, 'Backboard cannot support an object store named "' + name + '" due to a name collision with a built-in property'));
            });

            it('should error when existing database contains "' + name + '"', () => {
                return new backboard.Promise((resolve, reject) => {
                        const request = indexedDB.open('test', 1);
                        request.onerror = event => reject(event.target.error);
                        request.onblocked = () => reject(new Error('Unexpected blocked event'));
                        request.onupgradeneeded = event => {
                            const rawDB = event.target.result;
                            rawDB.createObjectStore(name, {keyPath: 'key'});
                        };
                        request.onsuccess = event => {
                            event.target.result.close();
                            resolve();
                        };
                    })
                    .then(() => backboard.open('test', 1))
                    .then(assert.fail)
                    .catch(err => assert.equal(err.message, 'Backboard cannot support an object store named "' + name + '" due to a name collision with a built-in property'));
            });
        });
    });

    describe('Schema upgrades', () => {
        beforeEach(() => {
            return backboard.open('test', 1, upgradeDB => {
                    const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                    playerStore.createIndex('tid', 'tid');

                    upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
                })
                .then(db => db.close());
        });

        it('should create new object store', () => {
            return backboard.open('test', 2, upgradeDB => {
                    upgradeDB.createObjectStore('games');
                })
                .then(db => {
                    assert.deepEqual([...db.objectStoreNames].sort(), ['games', 'players', 'teams']);
                    db.close();
                });
        });

        it('should delete obsolete object store', () => {
            return backboard.open('test', 2, upgradeDB => {
                    upgradeDB.deleteObjectStore('teams');
                })
                .then(db => {
                    assert.deepEqual([...db.objectStoreNames].sort(), ['players']);
                    db.close();
                });
        });

        it('should create new index', () => {
            return backboard.open('test', 2, upgradeDB => {
                    upgradeDB.teams.createIndex('foo', 'foo', {unique: true});
                })
                .then(db => {
                    assert.deepEqual([...db.teams.indexNames].sort(), ['foo']);
                    db.close();
                });
        });

        it('should delete obsolete index', () => {
            return backboard.open('test', 2, upgradeDB => {
                    upgradeDB.players.deleteIndex('tid');
                })
                .then(db => {
                    assert.equal(db.players.indexNames.length, 0);
                    db.close();
                });
        });

        it('should gracefully handle upgrades when multiple database connections are open', () => {
            return backboard.open('test', 1)
                .then(db => {
                    assert.equal(db.version, 1);

                    let versionchangeCount = 0;

                    db.on('versionchange', () => {
                        versionchangeCount += 1;
                        db.close();
                    });

                    return backboard.open('test', 2, upgradeDB => {
                            upgradeDB.deleteObjectStore('teams');
                        })
                        .then(db2 => {
                            assert.equal(db2.version, 2);
                            db2.close();
                        })
                        .then(() => assert.equal(versionchangeCount, 1));
                });
        });

        it('should emit blocked event if versionchange does not close connection', () => {
            return backboard.open('test', 1)
                .then(db => {
                    assert.equal(db.version, 1);

                    let versionchangeCount = 0;
                    let blockedCount = 0;

                    db.on('versionchange', () => {
                        versionchangeCount += 1;
                    });

                    backboard.on('blocked', () => {
                        blockedCount += 1;
                        db.close();
                    });

                    return backboard.open('test', 2, upgradeDB => {
                            upgradeDB.deleteObjectStore('teams');
                        })
                        .then(db2 => {
                            assert.equal(db2.version, 2);
                            db2.close();
                        })
                        .then(() => {
                            assert.equal(versionchangeCount, 1);
                            assert.equal(blockedCount, 1);
                        });
                });
        });
    });
});