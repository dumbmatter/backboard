module.exports = (recordStore, options) => {
    options = options !== undefined ? options : {};
    options.key = options.hasOwnProperty('key') ? options.key : null;
    options.direction = options.hasOwnProperty('direction') ? options.direction : 'next';
    options.callback = options.hasOwnProperty('callback') ? options.callback : null;

    return new Promise((resolve, reject) => {
        const request = recordStore.openCursor(options.key, options.direction);
        request.onsuccess = (event) => {
            const cursor = event.target.result;

            if (cursor) {
                if (options.callback !== null) {
                    let shortCircuit = false;
                    let advance = null;

                    const shortCircuitFunction = () => {
                        shortCircuit = true;
                    };
                    const advanceFunction = (count) => {
                        advance = count;
                    };

                    const callbackResult = options.callback(cursor.value, shortCircuitFunction, advanceFunction);
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
                }
            } else {
                resolve();
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
};