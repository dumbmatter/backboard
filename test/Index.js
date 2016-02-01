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

describe('Index', () => {
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

    it('should allow query by index', () => {
        return db.players.add(player)
            .then(() => {
                return db.players.index('tid').get(1);
            })
            .then((playerFromDb) => {
                assert.deepEqual(playerFromDb, player);
            });
    });

    it('should return undefined if no matching key', () => {
        return db.players.add(player)
            .then(() => {
                return db.players.index('tid').get(2);
            })
            .then((playerFromDb) => {
                assert.equal(playerFromDb, undefined);
            });
    });
});