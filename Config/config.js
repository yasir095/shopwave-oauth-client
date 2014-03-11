/**
 * Created by yasirmahmood on 27/01/2014.
 */
var environment = "development";

switch(environment) {

    case "development":
        var authServerUrl = "http://secure.merchantstack.com";
        var apiServerUrl = "http://api.merchantstack.com";
        break;
    case "staging":

        break;
    case "production":
        var authServerUrl = "http://secure.merchantstack.com";
        var apiServerUrl = "http://api.merchantstack.com";
        break;
}

module.exports = {

    authServerUrl       : authServerUrl,
    apiServerUrl        : apiServerUrl,

    accessType          : "online",
    defaultScope        : "application",
    responseType        : "code",
    acceptEncoding      : null          //possible option "gzip, inflate"
};
