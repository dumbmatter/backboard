import DB from './DB';

class UpgradeDB extends DB {
    constructor(rawDb, oldVersion) {
        super(rawDb);

        this.oldVersion = oldVersion;
    }
}

export default UpgradeDB;