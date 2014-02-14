shopwave-oauth-client
=====================

A basic shopwave oauth client for node.js . This API allows users to authenticate against Shopwave OAUTH Server. It also has support for API calls, that can be used to get user data & make other GET/POST api calls.

Installation
=====================

```
$ npm install shopwaveOauthClient
```

Examples
==========

Here is an example on how to use it:

## OAuth

```javascript

    var accessChecker = function(req, res, next){
        var config = {
            authServerUrl : "http://secure.merchantstack.com",
            clientUrl     : "http://your.site.url.here",
            apiServerUrl  : "http://shopwave-api-url-here",
            clientId      : "*****your clientId here*******",
            clientSecret  : "*****your clientSecret here***"
        };

        req.oAuthClient = oAuthClient.createConnection(config);
        req.oAuthClient.accessChecker(req, res, function(responseObject){

            //if authentication successful then call next
            if(req.session.oAuthCookie!== undefined &&
                            req.session.oAuthCookie.accessToken !== undefined){
                delete req.query.code;
                next();
            }
            else{
                //on authentication failure just redirect to client url.
                res.redirect(config.clientUrl);
            }
        });
    }
```