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

describe('Error Handling', () => {
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

    it('should to transaction if caught in request', () => {
        return db.tx('players', 'readwrite', (tx) => {
            return tx.players.add(player)
                .then((key) => {
                    assert.equal(key, 4);
                    return tx.players.add(player);
                })
                .then(assert.fail)
                .catch((err) => {
                    assert.equal(err.name, 'ConstraintError');
                });
        });
    });

    it('should propagate error to transaction if not caught', () => {
        return db.tx('players', 'readwrite', (tx) => {
            return tx.players.add(player)
                .then((key) => {
                    assert.equal(key, 4);
                    return tx.players.add(player);
                });
        })
        .then(assert.fail)
        .catch((err) => {
            assert.equal(err.name, 'ConstraintError');
        });
    });

    it.only('should propagate error to transaction even if no return inside transaction', () => {
        return db.tx('players', 'readwrite', (tx) => {
            tx.players.add(player)
                .then((key) => {
                    assert.equal(key, 4);
                    return tx.players.add(player);
                });
        })
//        .then(assert.fail)
        .catch((err) => {
console.log(err);
//            assert.equal(err.name, 'ConstraintError');
        });
    });

    it('should propagate error to database if not caught anywhere');
});
