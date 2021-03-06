import assert from 'assert';
import backboard from '../index';

let db, player;

describe('Transaction', () => {
    beforeEach(() => {
        player = {
            pid: 4,
            tid: 1,
            name: 'John Smith'
        };

        return backboard.open('test', 1, upgradeDB => {
                const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                playerStore.createIndex('tid', 'tid');

                upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
            })
            .then((dbLocal) => {
                db = dbLocal;
            });
    });

    afterEach(() => {
        db.close();
        return backboard.delete('test');
    });

    it('should resolve after transaction completes', () => {
        return db.tx('players', 'readwrite', tx => {
                return tx.players.put(player)
                    .then(() => {
                        player.name = 'Updated';
                        return tx.players.put(player);
                    })
                    .then(() => 'foo');
            })
            .then((val) => assert.equal(val, 'foo'))
            .then(() => db.players.get(4))
            .then(playerFromDb => assert.equal(playerFromDb.name, 'Updated'));
    });

    it('should have some kind of error when using a completed transaction', () => {
        let tx;
        return db.tx('players', 'readwrite', (txLocal) => {
                tx = txLocal;
            })
            .then(() => tx.players.get(4))
            .then(assert.fail)
            .catch((err) => assert.equal(err.name, 'TransactionInactiveError'));
    });

    it('should abort transaction on Transaction.abort() call', () => {
        return db.tx('players', 'readwrite', tx => {
            tx.players.put(player);

            return tx.players.get(4)
                .then(player => {
                    assert.equal(player.pid, 4);

                    tx.abort();

                    return db.players.get(4);
                })
                .then(player => {
                    assert.equal(player, undefined);
                    assert.equal(tx.error, null);
                });
        });
    });

    it('should error for invalid object store', () => {
        return db.tx('foo', 'readwrite')
            .then(assert.fail)
            .catch(err => assert.equal(err.name, 'NotFoundError'));
    });

    it('should error for invalid mode', () => {
        return db.tx('players', 'foo')
            .then(assert.fail)
            .catch(err => assert.equal(err.name, 'TypeError'));
    });

    it('should propagate thrown error to transaction, but not abort transaction', () => {
        return db.tx('players', 'readwrite', tx => {
                return tx.players.add(player)
                    .then((key) => {
                        assert.equal(key, 4);
                        throw new Error('foo');
                    });
            })
            .then(assert.fail)
            .catch(err => assert.equal(err.message, 'foo'))
            .then(() => db.players.get(4))
            .then((player) => assert.equal(player.pid, 4));
    });

    describe('error propagation', () => {
        // Weird hack I don't understand for Firefox. Otherwise this triggers window.onerror for some reason, and that causes the test to fail.
        let originalOnerror;
        before(() => {
            if (typeof window !== 'undefined') {
                originalOnerror = window.onerror;
                window.onerror = err => console.log(err);
            }
        });
        after(() => {
            if (typeof window !== 'undefined') {
                window.onerror = originalOnerror;
            }
        });

        it('should propagate request error to transaction', () => {
            return db.tx('players', 'readwrite', tx => {
                    return tx.players.add(player)
                        .then((key) => {
                            assert.equal(key, 4);
                            return tx.players.add(player);
                        });
                })
                .then(assert.fail)
                .catch(err => assert.equal(err.name, 'ConstraintError'))
                .then(() => db.players.get(4))
                .then((player) => assert.equal(player, undefined));
        });

        it('should propagate request error to transaction even if no return inside callback', () => {
            return db.tx('players', 'readwrite', tx => {
                    tx.players.add(player)
                        .then((key) => {
                            assert.equal(key, 4);
                            return tx.players.add(player);
                        });
                })
                .then(assert.fail)
                .catch(err => assert.equal(err.name, 'ConstraintError'))
                .then(() => db.players.get(4))
                .then((player) => assert.equal(player, undefined));
        });
    });

    describe('properties', () => {
        it('db', () => {
            return db.tx('players', 'readwrite', tx => {
                assert.equal(tx.db.name, 'test');
            });
        });

        it('error', () => {
            return db.tx('players', tx => {
                assert.equal(tx.error, null);
            });
        });

        it('mode', () => {
            const p1 = db.tx('players', 'readwrite', tx => {
                assert.equal(tx.mode, 'readwrite');
            });

            const p2 = db.tx('players', tx2 => {
                assert.equal(tx2.mode, 'readonly');
            });

            return Promise.all([p1, p2]);
        });
    });

    it('should have sensible order of operations', () => {
        const operations = [];
        return db.tx('players', 'readwrite', () => {
                operations.push(1);
                return db.tx('players', 'readwrite', () => operations.push(2))
                    .then(() => {
                        return new backboard.Promise(resolve => setTimeout(() => {
                            operations.push(3);
                            resolve();
                        }, 100));
                    });
            })
            .then(() => operations.push(4))
            .then(() => assert.deepEqual(operations, [1, 2, 3, 4]));
    });
});