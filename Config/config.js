/**
 * Created by yasirmahmood on 27/01/2014.
 */
var environment = "development";

switch(environment) {

    case "development":
        var oAuthBaseUrl = "http://secure.merchantstack.com";
        var apiBaseUrl   = "http://api.merchantstack.com";
        var authUri      = "/oauth/authorize";
        var tokenUri     = "/oauth/token";
        var logoutUri    = "/logout";
        break;
    case "staging":

        break;
    case "production":
        var oAuthBaseUrl = "http://secure.merchantstack.com";
        var apiBaseUrl   = "http://api.merchantstack.com";
        var authUri      = "/oauth/authorize";
        var tokenUri     = "/oauth/token";
        var logoutUri    = "/logout";
        break;
}

module.exports = {

    oAuthBaseUrl       : oAuthBaseUrl,
    apiBaseUrl        : apiBaseUrl,
    apiVersion          : "0.6", //supply your api version in ConnectionConfig.options

    accessType          : "online",
    defaultScope        : "application",
    responseType        : "code",
    acceptEncoding      : null,          //possible option "gzip, inflate"
    displayErrorLog     : true
};
