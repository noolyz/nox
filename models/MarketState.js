const { Schema, model } = require('mongoose');

const marketStateSchema = new Schema({
    // Usaremos un ID fijo para tener siempre un único documento de estado
    stateId: { type: String, default: 'main_market', unique: true },
    currentState: { type: String, default: 'stable' }, // bull, bear, volatile, stable
    lastStateChange: { type: Date, default: Date.now },
});

const MarketState = model('MarketState', marketStateSchema);

module.exports = MarketState;

