/**
 * Created by yasirmahmood on 27/01/2014.
 */
var environment = "development";

switch(environment) {

    case "development":
        var authServerUrl = "http://secure.merchantstack.com";
        var apiServerUrl = "http://api.merchantstack.com";
        var authUri      = "/oauth/authorize";
        var tokenUri     = "/oauth/token";
        var logoutUri    = "/logout";
        break;
    case "staging":

        break;
    case "production":
        var authServerUrl = "http://secure.merchantstack.com";
        var apiServerUrl = "http://api.merchantstack.com";
        var authUri      = "/oauth/authorize";
        var tokenUri     = "/oauth/token";
        var logoutUri    = "/logout";
        break;
}

module.exports = {

    authServerUrl       : authServerUrl,
    apiServerUrl        : apiServerUrl,
    apiVersion          : "0.6",

    accessType          : "online",
    defaultScope        : "application",
    responseType        : "code",
    acceptEncoding      : null,
    displayErrorLog     : true
};