import iterate from './iterate';
import wrapRequest from './wrap-request';

class Index {
    constructor(objectStore, name) {
        this.objectStore = objectStore;
        this.name = name;
        this._rawIndex = objectStore._getRaw().index(name);
    }

    get keyPath() {
        return this._rawIndex.keyPath;
    }

    get multiEntry() {
        return this._rawIndex.multiEntry;
    }

    get unique() {
        return this._rawIndex.unique;
    }

    iterate(...args) {
        return iterate(this._rawIndex, ...args);
    }
}

['count', 'get', 'getAll'].forEach(methodName => {
    Index.prototype[methodName] = function (...args) {
        return wrapRequest(() => this._rawIndex, methodName, ...args);
    };
});

export default Index;