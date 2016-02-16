# Full Backboard API

Since Backboard is based on IndexedDB, you kind of need to understand [the IndexedDB API](https://www.w3.org/TR/2015/REC-IndexedDB-20150108/) to fully understand Backboard. Anything below that references something starting with `IDB` comes from IndexedDB.

## `backboard`

Main variable exposed by Backboard, which you can access via:

    let backboard = require('backboard');

### `backboard.open(name, version, upgradeCallback)`

Returns a promise that resolves to a `DB` instance.

`name` is a string containing the database name, `version` is a number containing the database version. Both are passed directly through to `IDBFactory.open`.

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

    backboard.on('blocked', callback);
    backboard.off('blocked', callback);

## `DB`

A `DB` object represents an open connection to an underlying IndexedDB database, which you obtain from `backboard.open(name, version, upgradeCallback)`.

### `db.close()`

Closes the database connection. This function is synchronous and returns nothing. Same as `IDBDatabase.close()`.

    db.close();

### `db.tx(storeNames, mode, callback)`

Opens a transaction on `storeNames` (either a string containing the name of an object store, or an array of object store names). `mode` can be set to 'readonly' or 'readwrite'. If `mode` is emitted, it defaults to 'readonly'. `callback` is a callback function that recieves a `Transaction` instance.

`db.tx(storeNames, mode, callback)` returns a promise that, when there is no error, resolves with the return value of `callback` when the transaction completes. If the transaction aborts, the returned promise is rejected. If the transaction completes but there is a non-database-related error thrown in `callback`, the returned promise is also rejected. Here are some examples of these three cases from backboard's unit tests:

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

`db.[ObjectStoreName]` contains an ObjectStore instance for the object store with the given name. For instance, for an object store named 'foo', you can access it with `db.foo`. Then, each command on that object store is done in its own transaction. See [the README](README.md#transaction-free-api) for more.

These are all identical to their equivalents on `IDBDatabase`.

* `db.name`: String, database name.
* `db.objectStoreNames` DOMStringList containing the names of the object stores in this database.
* `db.version`: Number, database version.

## `UpgradeDB`

`UpgradeDB` inherits from `DB` so it has all the same methods and properties plus some extra ones.

### `upgradeDB.createObjectStore(name, options)`

Synchronously creates an object store. Options are the same as in `IDBDatabase.createObjectStore`. The `name` is restricted to not collide with any method or property on `DB` or `Transaction` objects.

### `upgradeDB.deleteObjectStore(name)`

Synchronously deletes an object store, like `IDBDatabase.deleteObjectStore`.

### Properties

* `upgradeDB.oldVersion`: version of the database the previous time it was opened.

## `Transaction`

A `Transaction` object represents an IndexedDB transaction, which you create with `db.tx(storeNames, mode, callback)`.

### `tx.abort()`

### Properties

`tx.[ObjectStoreName]` contains an ObjectStore instance for the object store with the given name. For instance, for an object store named 'foo' that is part of the current transaction, you can access it with `tx.foo`. Then, each command on that object store is done in the current transaction. See [the README](README.md#transaction-based-api) for more.

These are all identical (or nearly identical) to their equivalents on `IDBTransaction`.

* `tx.db`: Contains the `DB` instance that created this transaction.
* `tx.error`: If an error occurred in the transaction, this contains the error object. Otherwise it is null.
* `tx.mode`: Contains the `mode` parameter that was passed to `db.tx`, either 'readwrite' or 'readonly'.

## `ObjectStore`

An `ObjectStore` object represents an IndexedDB object store, which you create with `upgradeDB.createObjectStore(name, options)` and access with either `db.[ObjectStoreName]` or `tx.[ObjectStoreName]`.

### `add(value, key)` <br> `clear()` <br> `count(key)` <br> `delete(key)` <br> `get(key)` <br> `getAll(key, count)` <br> `put(value, key)`

These all work identically to their `IDBObjectStore` counterparts, except they return promises that resolve or reject based on the success or failure of the operation.

Methods that work only in readwrite transactions: `add(value, key)` inserts a new object into the database, and `put(value, key)` is similar but does an upsert. `clear()` empties the object store. `delete(key)` deletes an object from the store.

Methods that work in any transaction: `count(key)` returns the number of records matching `key`, or the number of records total if no `key` is supplied. `get(key)` returns the object matching `key`. `getAll(key, count)` returns all objects matching `key` up to the limit `count` (this method is not actually part of the official IndexedDB spec yet, but it is supported by the latest versions of Chrome and Firefox and [there is a polyfill for older versions](https://github.com/dumbmatter/IndexedDB-getAll-shim)).

In many of these functions, `key` can be either the value of an object's key or a key range such as from `backboard.lowerBound(lower, open)`, `backboard.upperBound(lower, open)`, `backboard.only(value)`, or `backboard.bound(lower, upper, lowerOpen, upperOpen)`.

### `objectStore.iterate(key, direction, callback)`

### `objectStore.index(name)`

Returns an `Index` instance for the underlying IndexedDB index called `name`.

### `objectStore.createIndex(name, keyPath, options)`

Creates a new index, same as `IDBObjectStore.createIndex`. This only works during version upgrades as a part of `UpgradeDB`.

### `objectStore.deleteIndex(name)`

Deletes an index, same as `IDBObjectStore.deleteIndex`. This only works during version upgrades as a part of `UpgradeDB`.

### Properties

These are all identical to their equivalents on `IDBObjectStore`.

* `autoIncrement`: Value of the `autoIncrement` option for the underlying object store.
* `indexNames`: DOMStringList containing the names of the indexes in this object store.
* `keyPath`: Value of the `keyPath` option for the underlying object store.

## `Index`

An `Index` object represents an IndexedDB object store, which you create with `objectStore.createIndex(name, keyPath, options)` and access with either `objectStore.index(name)`.

### ``