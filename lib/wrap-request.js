import Backboard from '..';

export default (recordStoreFactory, method, ...args) => {
    return new Backboard.Promise((resolve, reject) => {
        const readwriteRequired = ['add', 'clear', 'delete', 'put'];
        const mode = readwriteRequired.indexOf(method) >= 0 ? 'readwrite' : undefined;

        const request = recordStoreFactory(mode, resolve, reject)[method](...args);
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => {
            // Error is handled here, no need to propagate to transaction or database level
            event.stopPropagation();

            reject(event.target.error);
        };
    });
};