import backboard from './backboard';

// Inlined from https://github.com/then/is-promise
function isPromise(obj) {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

// args are key, direction, and callback. But all are optional and it's smart enough to figure out what they are in any order.
export default (recordStore, ...args) => {
    let key = null;
    let direction = 'next';
    let callback = () => {};

    args.forEach(x => {
        if (typeof x === 'function') {
            callback = x;
        } else if (x === 'next' || x === 'nextunique' || x === 'prev' || x === 'prevunique') {
            direction = x;
        } else if (x !== undefined) {
            key = x;
        }
    });

    return new backboard.Promise((resolve, reject) => {
        const request = recordStore.openCursor(key, direction);
        request.onsuccess = event => {
            const cursor = event.target.result;

            if (cursor) {
                let shortCircuit = false;
                let advance = null;

                const shortCircuitFunction = () => {
                    shortCircuit = true;
                };
                const advanceFunction = count => {
                    advance = count;
                };

                const callbackResult = callback(cursor.value, shortCircuitFunction, advanceFunction);

                const withUpdatedValue = updatedValue => {
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
                };

                if (isPromise(callbackResult)) {
                    backboard.Promise.resolve(callbackResult)
                        .then(withUpdatedValue)
                        .catch(reject);
                } else {
                    try {
                        withUpdatedValue(callbackResult);
                    } catch (err) {
                        reject(err);
                    }
                }
            } else {
                resolve();
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
};