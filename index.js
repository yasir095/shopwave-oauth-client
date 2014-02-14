/**
 * Created by yasirmahmood on 27/01/2014.
 */
var ConnectionConfig = require('./lib/ConnectionConfig'),
    Auth   = require('./lib/Auth');

exports.createConnection = function(config) {
    return new Auth({config: new ConnectionConfig(config)});
};