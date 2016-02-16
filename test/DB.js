import assert from 'assert';
import backboard from '../index';

let db;

describe('DB', () => {
    beforeEach(() => {
        return backboard.open('test', 1, upgradeDB => {
                const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                playerStore.createIndex('tid', 'tid');

                upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
            })
            .then(dbLocal => {
                db = dbLocal;
            });
    });

    afterEach(() => {
        db.close();
        return backboard.delete('test');
    });

    describe('properties', () => {
        it('name', () => {
            assert.equal(db.name, 'test');
        });

        it('version', () => {
            assert.equal(db.version, 1);
        });
    });
});