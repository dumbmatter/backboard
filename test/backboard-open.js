import assert from 'assert';
import Backboard from '..';

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
    afterEach(() => {
        return Backboard.delete('test');
    });

    it('should create object stores', () => {
        return Backboard.open('test', schemas)
            .then(db => db.close());
    });

    it('should do something if there is an object store with the same name as a Backboard DB or Transaction property');

    describe('Schema upgrades', () => {
        beforeEach(() => {
            return Backboard.open('test', schemas)
                .then(db => db.close());
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
                .then(db => {
                    assert.deepEqual([...db.objectStoreNames].sort(), ['games', 'players', 'teams']);
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
                .then(db => {
                    assert.deepEqual([...db.objectStoreNames].sort(), ['players']);
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
                .then(db => {
                    assert.deepEqual([...db.teams.indexNames].sort(), ['foo', 'tid']);
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
                .then(db => {
                    assert.equal(db.teams.indexNames.length, 0);
                    db.close();
                });
        });

        it('should recreate index if options change'); // How to test this? Need to actually use feature of Index, or read index.multiEntry property (need to expose it first, though)
        it('should run upgradeFunction if present');

        it('should gracefully handle upgrades when multiple database connections are open', () => {
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

            return Backboard.open('test', schemas)
                .then(db => {
                    assert.equal(db.version, 1);

                    let versionchangeCount = 0;

                    db.on('versionchange', () => {
                        versionchangeCount += 1;
                        db.close();
                    });

                    return Backboard.open('test', newSchemas)
                        .then(db2 => {
                            assert.equal(db2.version, 2);
                            db2.close();
                        })
                        .then(() => assert.equal(versionchangeCount, 1));
                });
        });
    });
});