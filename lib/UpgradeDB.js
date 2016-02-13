import DB from './DB';

class UpgradeDB extends DB {
    constructor(rawDb, tx, oldVersion) {
        super(rawDb, tx);

        this.oldVersion = oldVersion;
    }
}

export default UpgradeDB;