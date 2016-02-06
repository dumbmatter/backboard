# Backboard [![Build Status](https://travis-ci.org/dumbmatter/backboard.svg?branch=master)](https://travis-ci.org/dumbmatter/backboard)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/dumbmatter.svg)](https://saucelabs.com/u/dumbmatter)

Backboard is a thin promise-based wrapper around the IndexedDB API, designed to let you mix promises and IndexedDB without sacrificing performance or writing ridiculously messy code.

This part of the README probably needs to be rewritten, but...

There are other similar projects, but none of them do quite what I want. They all seem to fall in one of these two categories:

1. They support less features than the raw IndexedDB API, which is not good for a DB-heavy app that is already struggling to deal with IndexedDB's limited feature set.

2. They support extra stuff beyond the raw IndexedDB API, like caching or joins or advanced filtering. That's all great, but then you have this black box sitting between your application and your database, and I don't want a black box potentially interfering with performance or portability or anything like that.

So the goal of Backboard is to expose all of the functionality of IndexedDB with no extra features, just wrapped in a (IMHO) sane promise-based API.

## Example Usage

    const Backboard = require('backboard');

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
    }, {
        // This is copy/pasted from version 1, but with a new index. Backboard will do a diff between versions and figure out what needs to be created/deleted/modified. And if you need to update the actual data in the database, you can use the upgradeFunction property.
        version: 2,
        objectStores: {
            players: {
                options: {keyPath: 'pid', autoIncrement: true},
                indexes: {
                    name: {keyPath: 'name', unique: true},
                    tid: {keyPath: 'tid'}
                }
            },
            teams: {
                options: {keyPath: 'pid', autoIncrement: true},
                indexes: {
                    tid: {keyPath: 'tid', unique: true}
                }
            }
        },
        upgradeFunction: (event) => {
            // This still uses raw IndexedDB API. Would be nice to do better.
            // Also you'd need to write some manual code here if you want to delete and recreate an object store with different options (not indexes, I mean keyPath and autoIncrement).
            const tx = event.currentTarget.transaction;
            tx.objectStore('players').openCursor().onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const p = cursor.value;
                    p.name = 'Player Name';
                    cursor.update(p);
                    cursor.continue();
                }
            };
        }
    }];

    Backboard.open('database-name', schemas)
        .then((db) => {
            // See the Error Handling section below to learn why you really want to do this
            db.on('quotaexceeded', () => console.log('Quota exceeded! Fuck.'));
            db.on('versionchange', () => db.close());

            // Transaction-free API: each command is in its own transaction
            return db.players.add({
                    pid: 4,
                    name: 'Bob Jones',
                    tid: 0
                })
                .then(key => {
                    console.log(key);
                    return db.players.index('tid').get(0);
                })
                .then(player => console.log(player));
                .then(() => {
                    // Transaction API: transaction can be reused across many queries - can provide a huge performance boost!
                    db.tx('players', 'readwrite', tx =>
                            return tx.players.add({
                                    name: 'Bob Jones',
                                    tid: 0
                                })
                                .then(() => {
                                    return tx.players.index('tid').getAll(0);
                                })
                                .then((players) => {
                                    console.log(players);
                                });
                        })
                        .then(() => console.log('Transaction completed'));
                })
                .then(() => {
                    // No more cursors!
                    return db.players.index('tid')
                        .iterate(Backboard.lowerBound(0), 'next', (p, shortCircuit) => {
                            // Use the shortCircuit function to stop iteration after this callback runs
                            if (p.pid > 10) {
                                shortCircuit();
                            }

                            // Return undefined (or nothing) and it'll just go to the next object
                            // Return a value (or a promise that resolves to a value) and it'll replace the object in the database
                            p.foo = 'updated';
                            return p;
                        });
                })
                .then(() => {
                    // Other IndexedDB functions are present too
                    console.log(db.objectStoreNames);
                    return db.players.delete(0)
                        .then(() => db.teams.count())
                        .then(numTeams => console.log(numTeams))
                        .then(() => db.teams.clear());
                });

## Browser Compatibility

It's a bit tricky due to [the interaction between promises and IndexedDB transactions](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/). The current (early 2016) situation is:

**Chrome**: works out of the box.

**Firefox**: works if you use a third-party promises library that resolves promises with microtasks. Bluebird and es6-promise seem to work, and you can make Backboard use them by doing

    Backboard.setPromiseConstructor(require('bluebird'));

or

    Backboard.setPromiseConstructor(require('es6-promise').Promise);

**Edge/IE**: works only if you use a third-party promises library with synchronous promise resolution (which [is not a good thing](http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony)). If you want to go down that path, here's how to do it in Bluebird:

    const BPromise = require('bluebird');
    BPromise.setScheduler((fn) => fn());
    Backboard.setPromiseConstructor(BPromise);

Also Edge has a buggy IndexedDB implementation in general, so you might run into errors caused by that.

**Safari**: [who the fuck knows.](http://www.raymondcamden.com/2014/09/25/IndexedDB-on-iOS-8-Broken-Bad/)

## Error Handling

Error handling in IndexedDB is kind of complicated. An error in an individual operation (like an `add` when an object with that key already exists) triggers an error event at the request level which then bubbles up to the transaction and then the database. So the same error might appear in 3 different places, of course assuming that you're listening in all 3 places and that you don't manually stop the event propagation in one of the event handlers. Then you also have to worry about the distinction between error and abort events and about errors that happen only at the transaction and database levels (quick quiz: when you go over the disk space quota, is that an error or abort event, and at which level(s) does it occur?). So yeah... as you can imagine, a lot of the time, people don't really understand how all that works, and that can lead to errors being inadvertently missed.

Backboard removes some of that complexity (or call it "flexibilty" if you want to be more positive) at the expense of becoming slightly more opinionated. There's basically 3 things you have to know.

1. Errors in read/write operations don't bubble up. They just cause the promise for that operation to be rejected. This is because, as in all promise-based code, you should be chaining them together so errors don't get lost. For example:

            return db.players.put(x1)
                .then(db.players.add(x2))
                .then(db.players.get(4))
                .then(player => console.log(player));
                .catch(err => console.error(err)); // Logs an error from any of the above functions

2. If a transaction is aborted due to an error, the transaction promise is rejected. However if a transaction is manually aborted by calling `tx.abort()`, the transaction promise is not rejected.

        return db.tx('players', 'readwrite', tx => {
                return tx.players.put(x1)
                    .then(tx.players.add(x2))
                    .then(tx.players.get(4))
                    .then(player => console.log(player));
                    .catch(err => console.error(err));
            })
            .catch(err => console.error(err)); // Will contain an AbortError if the transaction aborts

    Also, if a request in a transaction fails, it always aborts the transaction. You can't use `event.preventDefault()` in the request's event handler to still commit the transaction like you can in the raw IndexedDB API. If someone actually uses this feature, we can think about how to add it, but I've never used it.

3. Once the database connection is open, basically no errors propagate down to the database object. There are two exceptions, **and you almost definitely want to handle these cases in your app**. First, `QuotaExceededError`, which happens when your app uses too much disk space. In the raw IndexedDB API, you get a `QuotaExceededError` in a transaction's abort event, which then bubbles up to the database's abort event. IMHO, this is a very special type of abort because you probably do want to have some kind of central handling of quota errors, since you likely don't want to add that kind of logic to every single transaction. So I made quota aborts special: all other aborts appear as rejected transactions, but quota aborts trigger an event at the database level. Listen to them like this:

        const cb = event => {
            // Do whatever you want here, such as displaying a notification that this error is probably caused by https://code.google.com/p/chromium/issues/detail?id=488851
        };
        db.on('quotaexceeded', cb);

    There is a similar `db.off` function you can use to unsubscribe, like `db.off('quotaexceeded', cb);`.

    The one other event you can listen to is the `versionchange` event, which you get when another instance of the database is trying to upgrade, such as in another tab. At a minimum, you probably want to close the connection so the upgrade can proceed:

        db.on('versionchange', () => db.close());

    Additionally, you can do things like saving data, reloading the page, etc. This is exactly the same as the `versionchange` event in the raw IndexedDB API.

That's it! I guess that is still a lot of text to describe error handling, so it's still kind of complicated. But I think it's less complicated than the raw IndexedDB API, and it does everything I want it to. Hopefully you feel the same way.

## API

Todo