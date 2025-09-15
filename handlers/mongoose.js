// handlers/mongoose.js

const mongoose = require('mongoose');
const { MongoURI } = require('../config.json');

mongoose.set('strictQuery', false);

module.exports = {
    async init() {
        if (!MongoURI) {
            return console.log('[WARNING] No MongoDB URI provided.');
        }

        try {
            await mongoose.connect(MongoURI);
            console.log('[INFO] Successfully connected to the MongoDB database!');
        } catch (error) {
            console.error('[ERROR] An error occurred while connecting to the database:');
            console.error(error);
        }
    }
};
