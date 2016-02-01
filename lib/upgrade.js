var deepEqual = require('deep-equal');

// Figure out the current schema and what needs to be done to upgrade to the latest one
module.exports = (event, schemas) => {
    const oldVersion = event.oldVersion;
    const newVersion = event.newVersion;
    const db = event.target.result;
    const tx = event.currentTarget.transaction;

    var prevSchema = {};
    schemas.forEach((schema) => {
        if (schema.version <= oldVersion || schema.version > newVersion) {
            prevSchema = schema;
            return;
        }

        const objectStores = schema.hasOwnProperty('objectStores') ? schema.objectStores : {};
        const prevObjectStores = prevSchema.hasOwnProperty('objectStores') ? prevSchema.objectStores : {};

        // Delete obsolete object stores
        Object.keys(prevObjectStores).forEach((objectStore) => {
            if (!objectStores.hasOwnProperty(objectStore)) {
                db.deleteObjectStore(objectStore);
            }
        });

        // Create new object stores
        Object.keys(objectStores).forEach((objectStore) => {
            if (!prevObjectStores.hasOwnProperty(objectStore)) {
                db.createObjectStore(objectStore, schema.objectStores[objectStore].options);
            }

            const indexes = objectStores[objectStore].hasOwnProperty('indexes') ? objectStores[objectStore].indexes : {};
            const prevIndexes = prevObjectStores.hasOwnProperty(objectStore) && prevObjectStores[objectStore].hasOwnProperty('indexes') ? prevObjectStores[objectStore].indexes : {};

            // Delete obsolete indexes
            Object.keys(prevIndexes).forEach((index) => {
                if (!indexes.hasOwnProperty(index) || !deepEqual(indexes[index], prevIndexes[index])) {
                    tx.objectStore(objectStore).deleteIndex(index);
                }
            });

            // Create new indexes
            Object.keys(indexes).forEach((index) => {
                if (!prevIndexes.hasOwnProperty(index) || !deepEqual(indexes[index], prevIndexes[index])) {
                    tx.objectStore(objectStore).createIndex(index, indexes[index].keyPath, indexes[index]);
                }
            });
        });

        prevSchema = schema;
    });
};