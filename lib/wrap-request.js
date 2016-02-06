const Backboard = require('..');

module.exports = (recordStoreFactory, method, value) => {
    return new Backboard.Promise((resolve, reject) => {
        const readwriteRequired = ['add', 'clear', 'delete', 'put'];
        const mode = readwriteRequired.indexOf(method) >= 0 ? 'readwrite' : undefined;

        const request = recordStoreFactory(mode, resolve, reject)[method](value);
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => {
            // Error is handled here, no need to propagate to transaction or database level
            event.stopPropagation();

            reject(event.target.error);
        };
    });
};