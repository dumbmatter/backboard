const Backboard = require('..');

const checkMicrotaskPromiseResolution = () => {
    let bool = true;

    const schemas = [{
        version: 1,
        objectStores: {
            players: {
                options: {keyPath: 'pid', autoIncrement: true}
            }
        }
    }];
    return Backboard.open('test', schemas)
        .then((db) => {
            return db.tx('players', 'readwrite', (tx) => {
                return tx.players.put({pid: 4})
                    .then(() => tx.players.get(4)) // If native promise implementation does not use microtasks, this will fail https://github.com/jakearchibald/indexeddb-promised#transaction-lifetime
                    .catch(err => {
                        if (err.name === 'TransactionInactiveError') {
                            bool = false;
                        } else {
                            throw err;
                        }
                    })
                    .then(() => {
                        db.close();
                        return Backboard.delete('test');
                    });
            });
        })
        .then(() => bool);
};

before(() => {
    // Use fake-indexeddb if real IndexedDB is not available (Node.js), but use real IndexedDB when possible (browser)
    if (typeof indexedDB === 'undefined') {
        GLOBAL.indexedDB = require('fake-indexeddb');
        GLOBAL.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');
    }

    // Would be better like checkMicrotaskPromiseResolution([() => require('es6-promise').Promise, ...])
    return checkMicrotaskPromiseResolution()
        .then((bool) => {
            if (!bool) {
                console.log('Native promises don\'t use microtasks, so trying es6-promise...');
                Backboard.setPromiseConstructor(require('es6-promise').Promise);

                return checkMicrotaskPromiseResolution()
                    .then(bool => {
                        if (!bool) {
                            const msg = 'Could not find a promise library that uses microtasks in your environment, so you\'re fucked.';
                            console.log(msg);
                            throw new Error(msg);
                        }
                    });
            }
        });
});