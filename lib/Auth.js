/**
 * Created with JetBrains WebStorm.
 * User: yasirmahmood
 * Date: 22/07/2013
 * Time: 16:49
 */

var request = require('request'),
    httpRequestBuilder = require('./HttpRequest');

module.exports = Auth;

function Auth(options){
    //private vars
    //public vars
    if(options!== undefined)
        this.config = options.config;
}
/**
 * Function Gets new Token depending on requestType i.e refreshToken, exchangeCodeForToken
 * Compulsory params : grantType provided as req.body.grantType
 * @type {{requestToken: Function}}
 * @return responseObject with error=true on error
 * else return empty object
 */
Auth.prototype = {

    connect : function(options){
        this.config = options.config;
    },

    requestToken: function(req, callback)
    {
        var requestObject = {},
            redirectUri = this.config.clientUrl,
            authCode = {},
            responseObject = {};

        if(req.query !== undefined && req.query.code !== undefined){
            authCode = req.query.code;
        }
        // get the accesstoken , requires authcode to be passed in params
        if (req.body.grantType == "authorization_code" || req.query.grant_type == "authorization_code") {

            requestObject = {
                url: this.config.authServerUrl + "/oauth/token",
                form: {
                    code: authCode,
                    redirect_uri: redirectUri,
                    client_id: this.config.clientId,
                    scope: this.config.defaultScope,
                    client_secret: this.config.clientSecret,
                    grant_type: req.body.grantType
                }
            };
        }
        // pass refresh token in this grant type to get a new accesstoken
        else if(req.body.grantType == 'refresh_token' || req.query.grant_type == "refresh_token") {
            requestObject = {
                url: this.config.authServerUrl + "/oauth/token",
                form: {
                    refresh_token: req.session.oAuthCookie.refreshToken,
                    redirect_uri: redirectUri,
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    grant_type: req.body.grantType
                }
            };
        }
        else
        {
            console.log("missing grantType");
            //Message.add('devError', 'missingRequiredParam', 'grantType not provided in params');
            callback({'error': true});
        }

        if(req.body.grantType !== undefined){
            request.post(requestObject,
                function (error, response, body) {
                    var responseObject = {};

                    if (error) {
                        //console.log(error);
                        //Message.add('error', 'unknownError', error);
                        delete req.body.grantType;
                        callback({'error': true});
                    } else {

                        response.headers.statusCode = response.statusCode;

                        if (typeof response.body !== 'undefined') {
                            try {
                                jsonResponse = response.body;
                                jsonParsed = JSON.parse(response.body);

                                var dateTime = new Date();
                                if(req.session.oAuthCookie === undefined)
                                {
                                    req.session.oAuthCookie = {};
                                }

                                req.session.oAuthCookie.accessToken = (jsonParsed.access_token !== undefined) ? jsonParsed.access_token : undefined;
                                req.session.oAuthCookie.expiresIn = (jsonParsed.expires_in !== undefined) ? jsonParsed.expires_in : undefined;
                                req.session.oAuthCookie.expiryDateTime = (jsonParsed.expires_in !== undefined) ? dateTime.setSeconds(dateTime.getSeconds() + jsonParsed.expires_in) : undefined;

                                if(req.body.grantType === 'authorization_code'){
                                    req.session.oAuthCookie.refreshToken =  jsonParsed.refresh_token;
                                }

                                delete req.body.grantType;
                                if(response.headers.statusCode != 200){
                                    if(req.session.oAuthCookie.accessToken === undefined || req.session.oAuthCookie.expiresIn === undefined){
                                        // Message.add('devError', 'unknownError', 'unable to get token or expiry date');
                                        responseObject.error = true;
                                    }
                                }

                            } catch (exception) {
                                //console.log(exception);
                                // Message.add('error', 'unknownError', exception);
                                responseObject.error = true;
                            }
                        }
                        responseObject.token = req.session.oAuthCookie;
                        callback(responseObject);
                    }

                }
            );
        }
    },

    /**
     * Function checks if token is expired or near expiry
     * automatically refreshes the token if expired.
     * requestObject must contain session i.e requestObject.session.expiryDateTime
     * @param requestObject
     * @param callback
     */
    verifyTokenDate : function(requestObject, callback){
        if(requestObject.session.oAuthCookie !== undefined){
            var dateTime = new Date();
            if(requestObject.session.oAuthCookie.expiryDateTime-100 < dateTime.getSeconds()){

                requestObject.body.grantType = 'refresh_token';
                Auth.requestToken(requestObject, callback);
            }else{
                callback(null); //all good go next
            }
        }else{
            console.log("you cannot supply null session to this function");
            callback({"error":true});
        }

    },

    /**
     * Checks if token is invalid or expired
     * must pass the response object that you get from api call.
     * Function checks the invalidToken, expiredToken errors in response
     * and takes action accordingly i.e renew token and reset token session data
     * refresh token if its expired
     * @param requestObject
     * @param callback
     */
    validateToken :  function(res, callback){

        var parsedString = {};

        if(res.body !== undefined){
            try{
                parsedString = JSON.parse(res.body);
            }catch(exception){

            }
        }

        if(parsedString.api !== undefined && parsedString.api.message !== undefined
            && parsedString.api.message.errors !== undefined
            && parsedString.api.message.errors['908'] !== undefined
            && parsedString.api.message.errors['908'].id == 908){

            callback({'error': true});
        }else{
            callback({'error': false})
        }
    },

    /**
     * accessChecker middlware can be used in app.js for user login verification
     * @return { token:
                   { accessToken: '7813ce10c738c644b0841ee0d33bfd5d05dfeab0',
                     expiresIn: 3600,
                     expiryDateTime: 1390836672164,
                     refreshToken: 'e13c70e988005323f2b234a2810b9f6c104e814d' },
                 error: true // can be null or undefined
               }
     *
     */
    accessChecker: function(req, res, callback) {
        res.header("x-powered-by", this.config.projectName);

        if (req.session.oAuthCookie !== undefined && req.session.oAuthCookie.expiryDateTime !== undefined) {
            this.verifyTokenDate(req, function(responseObject){
                callback(responseObject);
            });
            //  callback(null);
        }
        else{
            if(req.query.code !== undefined) {
                req.body.grantType = "authorization_code";
                this.requestToken(req, function(responseObject){
                    if(responseObject!=null && responseObject.error === true){
                        res.redirect('/auth'+'?code='+req.query.code);
                    }else{
                        callback(responseObject);
                    }
                });
            }
            else
            {
                var uriParts = "?access_type="+this.config.accessType
                    +"&redirect_uri="+this.config.clientUrl
                    +"&response_type="+this.config.responseType
                    +"&client_id="+this.config.clientId
                    +"&scope="+this.config.defaultScope;

                res.redirect(this.config.authServerUrl+'/login'+uriParts);

            }
        }
    },

    logout: function(req, res, callback){
        if(req.session !== undefined){
            req.session.destroy();
        }

        var uriParts = "?access_type="+this.config.accessType
            +"&redirect_uri="+this.config.clientUrl
            +"&response_type="+this.config.responseType
            +"&client_id="+this.config.clientId
            +"&scope="+this.config.defaultScope;

        res.redirect(this.config.authServerUrl+"/logout"+uriParts);
        callback();
    },

    /**
     *
     * @param req object with req.objHttpRequest Object such as
     *  { headers: {
     *      Authorization = 'OAuth '+ req.accessToken;
     *  },
     *  url: /user
     *  apiServerUrl: 'optional , if none provided default apiServerUrl will be used'
     *  method : GET or POST
     *  getParams: {},
     *  postBody:  {
     *      file: fileStreamObject //optional , required only if multipart is true
     *  },
     *  multipart: true //for file upload default false
     * }
     * @param res
     * @param callback
     */
    //@todo: code duplication at Auth.prototype, need improvements
    httpRequest: function(req, res, callback) {

        var defaultFileUploadPath = "/uploader";

        var objHttpRequest = {
            headers: {
                'Authorization' : 'OAuth '+ req.session.oAuthCookie.accessToken
            },
            method :        (req.objHttpRequest.method !== undefined)       ? req.objHttpRequest.method : 'GET',
            apiServerUrl:   (req.objHttpRequest.apiServerUrl !== undefined) ? req.objHttpRequest.apiServerUrl : this.config.apiServerUrl
        }
        objHttpRequest.body = {
            'postBody':  (req.objHttpRequest.postBody !== undefined) ? req.objHttpRequest.postBody: {}
        };

        // These params are optional so that why not included , only include if present. check if encoding specified in config object
        if(this.config.acceptEncoding !== undefined && this.config.acceptEncoding !== null && this.config.acceptEncoding.length>0){
            objHttpRequest.headers['accept-encoding'] = this.config.acceptEncoding;
        }
        if(req.objHttpRequest.filePath !== undefined){
            objHttpRequest.filePath = req.objHttpRequest.filePath;
        }
        // url is optional for fileUpload, for file upload if url not supplied will use default url i.e /uploader
        if(req.objHttpRequest.url === undefined && req.objHttpRequest.multipart !== true){
            console.log("request url not supplied, supply req.objHttpRequest.url='/your request url'");
            callback({'error': true});
        }
        if(req.objHttpRequest.headers !== undefined && Object.keys(req.objHttpRequest.headers).length>0){
            for(var headerId in req.objHttpRequest.headers)
            {
                if(req.objHttpRequest.headers.hasOwnProperty(headerId)){
                    objHttpRequest.headers[headerId] = req.objHttpRequest.headers[headerId];
                }
            }
        }

        if(req.session.oAuthCookie === undefined){
            console.log("sessionCookie is invalid");
            callback({'error': true});
        }
        else {

            var isMultipart = req.objHttpRequest.multipart;

            objHttpRequest.route = {};
            objHttpRequest.route.path = req.objHttpRequest.url;
            objHttpRequest.accessToken = req.session.oAuthCookie.accessToken;

            //req.objHttpRequest = objHttpRequest;  //override request object. placement is important, don't change

            if (objHttpRequest.filePath !== undefined && isMultipart === true) {

                objHttpRequest.method = (objHttpRequest.method === "PUT") ? objHttpRequest.method : "POST";
                objHttpRequest.route.path = (objHttpRequest.route.path === undefined) ? defaultFileUploadPath : objHttpRequest.route.path;

                httpRequestBuilder.multipartFileUpload(objHttpRequest, function (httpResponse) {

                    if (httpResponse !== undefined && httpResponse !== null) {

                        if (httpResponse.error == true) {
                            callback({error: httpResponse.error});
                        }
                        else if (httpResponse.statusCode === 404) {
                            callback({error: "not a valid request"});
                        }
                        else {
                            //@todo: this requires testing
                            Auth.prototype.validateToken.call(this, httpResponse, function (responseObject) {
                                if (responseObject.error === true) {
                                    /* Token is expired , request new token */
                                    req.body.grantType = "refresh_token"
                                    Auth.prototype.requestToken.call(this, req, function (tokenResponseObject) {

                                        if (tokenResponseObject.error === true) {
                                            callback({error: {'message': 'cant refresh token'}});
                                        }
                                        else {
                                            httpRequestBuilder.multipartFileUpload(objHttpRequest, function (resp) {
                                                callback(resp.data);
                                            });
                                        }
                                    });
                                }
                                else {
                                    delete req.objHttpRequest;
                                    callback(httpResponse.data);
                                }
                            });
                        }
                    } else {
                        console.log("got invalid i.e null response");
                        callback({error: {'message': 'got null response, check your api'}});
                    }

                });
            }
            else
            {
                httpRequestBuilder.makeCustomApiRequest(objHttpRequest, function (httpResponse) {

                    if (httpResponse.error == true) {
                        callback({error: httpResponse.error});
                    }
                    else if (httpResponse.statusCode === 404) {
                        callback({error: "not a valid request"});
                    }
                    else {
                        Auth.prototype.validateToken.call(this, httpResponse, function (responseObject) {
                            if (responseObject.error === true) {
                                /* Token is expired , request new token */
                                req.body.grantType = "refresh_token"
                                Auth.prototype.requestToken.call(this, req, function (tokenResponseObject) {

                                    if (tokenResponseObject.error === true) {
                                        callback({error: {'message': 'cant refresh token'}});
                                    }
                                    else {
                                        httpRequestBuilder.makeCustomApiRequest(objHttpRequest, function (resp) {
                                            callback(resp);
                                        });
                                    }
                                });
                            }
                            else {
                                delete req.objHttpRequest;
                                callback(httpResponse);
                            }
                        });

                    }
                });
            }
        }
    },



//---------------------------- API GET FUNCTIONS ----------------------------//
    /****************************************************************************/

    /**
     * @param req
     * @param res
     * @param options(supply atleast one of these in here i.e. storeId, basketId, consumerId, promotionId)
     * @param callback
     */
    getBasket: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/basket',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param options (productId can be supplied but not required)
     * @param callback
     */
    getProduct: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/product',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getUser: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/user',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getStatus: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/status',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getMerchant: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/merchant',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getCategory: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/category',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getStore: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/store',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param options(supply atleast one of these in here i.e. storeId, basketId, consumerId, promotionId)
     * @param callback
     */
    getPromotion: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/promotion',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getPromotionCode: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/promotion/code',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param options(reportFrom:YYYY-MM-DD HH:mm:ss, reportTo: YYYY-MM-DD HH:mm:ss required)
     * @param callback
     */
    getBasketReport: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/report/basket',
            method: 'GET'
        };

        for(var option in options){
            if(options.hasOwnProperty(option) !== undefined){
                objHttpRequest.headers[option] = options[option];
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    }

}