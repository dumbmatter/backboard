import assert from 'assert';
import Backboard from '..';

let db;

describe('DB', () => {
    beforeEach(() => {
        return Backboard.open('test', 1, upgradeDB => {
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
        return Backboard.delete('test');
    });

    describe('events', () => {
        it('on and off', (done) => {
            let quotaexceededCount = 0;

            db.on('quotaexceeded', value => {
                assert.equal(value, 'bar');
                quotaexceededCount += 1;
                if (quotaexceededCount === 2) {
                    done();
                }
            });
            db.on('quotaexceeded', value => {
                assert.equal(value, 'bar');
                quotaexceededCount += 1;
                if (quotaexceededCount === 2) {
                    done();
                }
            });
            db.on('versionchange', () => {
                done(new Error('Unexpected versionchange event'));
            });

            const toRemove = () => {
                quotaexceededCount += 1;
                done(new Error('Removed listener was called'));
            };
            db.on('quotaexceeded', toRemove);
            db.off('quotaexceeded', toRemove);

            db._emit('quotaexceeded', 'bar');
        });

        it('error on invalid listener name', () => {
            assert.throws(() => db.on('foo', () => {}), /Invalid listener name "foo"/);
        });
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