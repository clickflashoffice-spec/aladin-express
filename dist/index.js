"use strict";
const index = require('./src/index.js');
module.exports = index.default || index;
module.exports.default = index.default || index;
module.exports.createApp = index.createApp;
module.exports.createEcosystemServer = index.createEcosystemServer;
