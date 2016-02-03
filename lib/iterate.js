// x, y, z are key, direction, and callback. But all are optional and it's smart enough to figure out what they are in any order.
module.exports = (recordStore, ...args) => {
    let key = null;
    let direction = 'next';
    let callback = () => {};

    args.forEach((x) => {
        if (typeof x === 'function') {
            callback = x;
        } else if (x === 'next' || x === 'nextunique' || x === 'prev' || x === 'prevunique') {
            direction = x;
        } else if (x !== undefined) {
            key = x;
        }
    });

    return new Promise((resolve, reject) => {
        const request = recordStore.openCursor(key, direction);
        request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (cursor) {
                let shortCircuit = false;
                let advance = null;

                const shortCircuitFunction = () => {
                    shortCircuit = true;
                };
                const advanceFunction = (count) => {
                    advance = count;
                };

                const callbackResult = callback(cursor.value, shortCircuitFunction, advanceFunction);
                Promise.resolve(callbackResult)
                    .then((updatedValue) => {
                        // Only update if return value is not undefined
                        if (updatedValue !== undefined) {
                            cursor.update(updatedValue);
                        }

                        if (shortCircuit) {
                            resolve();
                        } else if (advance !== null) {
                            cursor.advance(advance);
                        } else {
                            cursor.continue();
                        }
                    })
                    .catch(reject);
            } else {
                resolve();
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
};