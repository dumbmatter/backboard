# Full Backboard API

## `backboard`

Main variable exposed by Backboard, which you can access via:

    let backboard = require('backboard');

### `backboard.open(name, version, upgradeCallback)`

Returns a promise that resolves to a `DB` instance.

`name` is a string containing the database name, `version` is a number containing the database version. Both are passed directly through to [the IndexedDB API](https://www.w3.org/TR/2015/REC-IndexedDB-20150108/).

`upgradeCallback` is called if `version` is greater than the version last opened, and it is the only place you can create and delete object stores and indexes. It's similar to an event handler for IndexedDB's `upgradeneeded` event. `upgradeCallback` receives an `UpgradeDB` instance which you can use to perform operations on the database.

    backboard.open('database-name', 2, upgradeDB => {
            if (upgradeDB.oldVersion <= 0) {
                const playerStore = upgradeDB.createObjectStore('players', {keyPath: 'pid', autoIncrement: true});
                playerStore.createIndex('tid', 'tid');

                upgradeDB.createObjectStore('teams', {keyPath: 'tid', autoIncrement: true});
            }

            if (upgradeDB.oldVersion <= 1) {
                upgradeDB.players.iterate(player => {
                    player.foo = 'updated';
                    return player;
                });
            }
        })
        .then(db => {
            // Now you can do stuff with db
        });

### `backboard.delete(name)`

Returns a promise that resolves upon successful deletion of the database `name`. Similar to `indexedDB.deleteDatabase`.

### `backboard.setPromiseConstructor(PromiseConstructor)`

By default, backboard will use whatever the global `Promise` object is. But if you want to overwrite that (such as [to make backboard work in Firefox](README.md#browser-compatibility)), call `backboard.setPromiseConstructor` and supply it with your preferred Promise constructor.

    let BPromise = require('bluebird');
    backboard.setPromiseConstructor(BPromise);

### `backboard.lowerBound(lower, open)` <br> `backboard.upperBound(lower, open)` <br> `backboard.only(value)` <br> `backboard.bound(lower, upper, lowerOpen, upperOpen)`

These are just wrappers around their `IDBKeyRange` equivalents. You can use them when querying `get`, `getAll`, and `iterate` from indexes and object stores.

### `backboard.on(name, handler)`

Add handlers to respond to certain events. The current events are `quotaexceeded` which fires when the disk quota is exceeded in any database, and `blocked` which fires when any database connection is blocked. See [the README](README.md#error-handling) for more.

    backboard.on('quotaexceeded', event => console.log('Quota exceeded!'));
    backboard.on('blocked', event => console.log('Databace connection blocked.'));

### `backboard.off(name, handler)`

Remove an event handler.

    backboard.on('blocked', cb);
    backboard.off('blocked', cb);

## `DB`

### `close()`

Closes the database connection. This function is synchronous and returns nothing. Same as `IDBDatabase.close()`.

    db.close();

### `tx(storeNames, mode, cb)`

Opens a transaction on `storeNames` (either a string containing the name of an object store, or an array of object store names). `mode` can be set to 'readonly' or 'readwrite'. If `mode` is emitted, it defaults to 'readonly'. `cb` is a callback function that recieves a `Transaction` instance.

`tx(storeNames, mode, cb)` returns a promise that, when there is no error, resolves with the return value of `cb` when the transaction completes. If the transaction aborts, the returned promise is rejected. If the transaction completes but there is a non-database-related error thrown in `cb`, the returned promise is also rejected. Here are some examples of these three cases from backboard's unit tests:

    player = {
        pid: 4,
        tid: 1,
        name: 'John Smith'
    };

    // Successful transaction resolves upon completion
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

    // Database errors result in aborted transactions
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

    // Non-database errors do not affect transaction completion
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

Although it is strictly not required to return promises for all your operations inside a transaction, I recommend that you do so because it makes error handling more straightforward.

### Properties

These are all identical to their equivalents on `IDBDatabase`.

* `name`: String, database name.
* `objectStoreNames` DOMStringList, names of object stores in this database.
* `version`: Number, database version.

## `UpgradeDB`

`UpgradeDB` inherits from `DB` so it has all the same methods and properties plus some extra ones.

### `createObjectStore(name, options)`

Synchronously creates an object store. Options are the same as in `IDBDatabase.createObjectStore`. The `name` is restricted to not collide with any method or property on `DB` or `Transaction` objects.

### `deleteObjectStore(name)`

Synchronously deletes an object store, like `IDBDatabase.deleteObjectStore`.

### Properties

* `oldVersion`: version of the database the previous time it was opened.

## `Transaction`

### ``

## `ObjectStore`

### ``

## `Index`

### ``