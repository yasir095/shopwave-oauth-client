/**
 * Created by yasirmahmood on 27/01/2014.
 */
var config = require('../Config/config');

var ConnectionConfig = function (options) {
    if (typeof options === 'string') {
        return "invalid params passed";
    }

    this.authServerUrl      = options.authServerUrl,
    this.clientUrl          = options.clientUrl,
    this.apiServerUrl       = options.apiServerUrl,
    this.clientId           = options.clientId,
    this.clientSecret       = options.clientSecret,
    this.projectName        = options.projectName,
    this.accessType         = options.accessType,
    this.defaultScope       = (options.defaultScope === undefined) ? config.defaultScope : options.defaultScope,
    this.responseType       = (options.responseType === undefined) ? config.responseType : options.responseType

};

module.exports = ConnectionConfig;