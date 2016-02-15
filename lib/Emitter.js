class Emitter {
    constructor(validListenerNames) {
        this.listeners = {};
        this.validListenerNames = validListenerNames;
    }

    _emit(name, value) {
        if (!this.listeners.hasOwnProperty(name)) {
            return;
        }
        if (this.validListenerNames.indexOf(name) < 0) {
            throw new Error('Invalid listener name "' + name + '"');
        }

        this.listeners[name].forEach(listener => listener(value));
    }

    on(name, cb) {
        if (!this.listeners.hasOwnProperty(name)) {
            this.listeners[name] = [];
        }
        if (this.validListenerNames.indexOf(name) < 0) {
            throw new Error('Invalid listener name "' + name + '"');
        }

        this.listeners[name].push(cb);
    }

    off(name, cb) {
        if (!this.listeners.hasOwnProperty(name)) {
            return;
        }
        if (this.validListenerNames.indexOf(name) < 0) {
            throw new Error('Invalid listener name "' + name + '"');
        }

        this.listeners[name] = this.listeners[name].filter(listener => listener !== cb);
    }
}

export default Emitter;