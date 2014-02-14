
/**
 * Shopwave OauthClient can be used as middleware. For working example check accessChecker below.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var oAuthClient = require('shopwaveOauthClient');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

/**
 * demonstration of shopwave OauthClient
 * the code below shows how to call oAuth client to get authenticated with shopwave server.
 * @param req
 * @param res
 * @param next
 * @return response will be in req object & callback function(responseObject) as well -
 *
 * example response object looks like:
 *
 * req.session.oAuthCookie{
 *      accessToken : ****************,
 *      refreshToken: ****************,
 *      expiryDateTime: 2014-01-01(javascript date)
 * }
 *
 */
var accessChecker = function(req, res, next){

    var config = {
        authServerUrl : "http://secure.merchantstack.com",
        clientUrl     : "http://your.site.url.here",
        apiServerUrl  : "http://api.merchantstack.com",
        clientId      : "*****your clientId here*******",
        clientSecret  : "*****your clientSecret here***"
    };

    req.oAuthClient = oAuthClient.createConnection(config);
    req.oAuthClient.accessChecker(req, res, function(responseObject){

        //if authentication successful then call next
        if(req.session.oAuthCookie!== undefined && req.session.oAuthCookie.accessToken !== undefined){
            delete req.query.code;
            next();
        }
        else{
            //on authentication failure just redirect to client url.
            res.redirect(config.clientUrl);
        }
    });
}


app.get('/', accessChecker, routes.index);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
