/**
 * Created with JetBrains WebStorm.
 * User: yasirmahmood
 * Date: 22/07/2013
 * Time: 16:49
 */
var request = require('request'),
    httpRequestBuilder = require('./HttpRequest');

module.exports = ShopwaveConnectManager;

function ShopwaveConnectManager(options){
    //private vars
    //public vars

    var config;

    if(options!== undefined)
        config = options.config;

    this.setConfig = function(c) {
        config = c;
    }

    this.getConfig = function() {
        return config;
    }
}
/**
 * Function Gets new Token depending on requestType i.e refreshToken, exchangeCodeForToken
 * Compulsory params : grantType provided as req.body.grantType
 * @type {{requestToken: Function}}
 * @return responseObject with error=true on error
 * else return empty object
 */

ShopwaveConnectManager.prototype = {

    connect : function(options){
        this.config = options.config;
    },

    requestToken: function(req, callback)
    {
        var requestObject = {},
            redirectUri = this.getConfig().clientUrl,
            authCode = {},
            responseObject = {};

        if(req.query !== undefined && req.query.code !== undefined){
            authCode = req.query.code;
        }
        // get the accesstoken , requires authcode to be passed in params
        if (req.body.grantType == "authorization_code" || req.query.grant_type == "authorization_code") {

            requestObject = {
                url: this.getConfig().authServerUrl + "/oauth/token",
                form: {
                    code: authCode,
                    redirect_uri: redirectUri,
                    client_id: this.getConfig().clientId,
                    scope: this.getConfig().defaultScope,
                    client_secret: this.getConfig().clientSecret,
                    grant_type: req.body.grantType
                }
            };
        }
        // pass refresh token in this grant type to get a new accesstoken
        else if(req.body.grantType == 'refresh_token' || req.query.grant_type == "refresh_token") {
            requestObject = {
                url: this.getConfig().authServerUrl + "/oauth/token",
                form: {
                    refresh_token: req.session.oAuthCookie.refreshToken,
                    redirect_uri: redirectUri,
                    client_id: this.getConfig().clientId,
                    client_secret: this.getConfig().clientSecret,
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
            requestObject.strictSSL = false;
            request.post(requestObject,
                function (error, response, body) {
                    var responseObject = {};

                    if (error) {
                        console.log("ERORR: ", error);
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
                                console.log("EX", exception);
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
                ShopwaveConnectManager.requestToken(requestObject, callback);
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
     * accessChecker middleware can be used in app.js for user login verification
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
        res.header("x-powered-by", this.getConfig().projectName);

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
                        console.log("problem getting authorizationCode. check your Oauth server.");
                        res.redirect('/notfound'+'?code='+req.query.code);
                    }else{
                        callback(responseObject);
                    }
                });
            }
            else
            {
                var uriParts = "?access_type="+this.getConfig().accessType
                    +"&redirect_uri="+this.getConfig().clientUrl
                    +"&response_type="+this.getConfig().responseType
                    +"&client_id="+this.getConfig().clientId
                    +"&scope="+this.getConfig().defaultScope;

                res.redirect(this.getConfig().authServerUrl+'/login'+uriParts);

            }
        }
    },

    logout: function(req, res, callback){
        if(req.session !== undefined){
            req.session.destroy();
        }

        var uriParts = "?access_type="+this.getConfig().accessType
            +"&redirect_uri="+this.getConfig().clientUrl
            +"&response_type="+this.getConfig().responseType
            +"&client_id="+this.getConfig().clientId
            +"&scope="+this.getConfig().defaultScope;

        res.redirect(this.getConfig().authServerUrl+"/logout"+uriParts);
        callback();
    },

    getParentInstance: function(){
        return this;
    },

    /**
     *
     * @param req object with req.objHttpRequest Object such as
     *  { headers: {
     *      Authorization = 'OAuth '+ req.accessToken;
     *      accept-encoding: "gzip, deflate" //or leave it , ist optional
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
            apiServerUrl:   (req.objHttpRequest.apiServerUrl !== undefined) ? req.objHttpRequest.apiServerUrl : this.getConfig().apiServerUrl
        }
        objHttpRequest.body = {
            'postBody':  (req.objHttpRequest.postBody !== undefined) ? req.objHttpRequest.postBody: {}
        };

        //get set default server API Version.
        if(this.getConfig().apiVersion !== undefined){
            objHttpRequest.headers['x-accept-version'] = this.getConfig().apiVersion;
        }
        // These params are optional so that why not included , only include if present. check if encoding specified in config object
        if(this.getConfig().acceptEncoding !== undefined && this.getConfig().acceptEncoding !== null && this.getConfig().acceptEncoding.length>0){
            objHttpRequest.headers['accept-encoding'] = this.getConfig().acceptEncoding;
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

                var parentInstance = this;
                httpRequestBuilder.multipartFileUpload(objHttpRequest, this.getConfig().displayErrorLog, function (httpResponse) {

                    if(httpResponse.data !== undefined && httpResponse.data.statusCode == 500){
                        console.log("Status: ",httpResponse.data.statusCode);
                    }

                    if (httpResponse !== undefined && httpResponse !== null) {

                        if (httpResponse.error == true) {
                            callback({error: httpResponse.error});
                        }
                        else if (httpResponse.data.statusCode === 404) {
                            callback({error: "not a valid request or something wrong with the server"});
                        }
                        else {
                            //@todo: this requires testing
                            ShopwaveConnectManager.prototype.validateToken.call(parentInstance, httpResponse, function (responseObject) {
                                if (responseObject.error === true) {
                                    /* Token is expired , request new token */
                                    req.body.grantType = "refresh_token"
                                    ShopwaveConnectManager.prototype.requestToken.call(parentInstance, req, function (tokenResponseObject) {

                                        if (tokenResponseObject.error === true) {
                                            callback({error: {'message': 'cant refresh token'}});
                                        }
                                        else {
                                            httpRequestBuilder.multipartFileUpload(objHttpRequest, this.getConfig().displayErrorLog, function (resp) {
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
                var parentInstace = this;
                httpRequestBuilder.makeCustomApiRequest(objHttpRequest, this.getConfig().displayErrorLog, function (httpResponse) {


                    if (httpResponse.error == true) {
                        callback({error: httpResponse.error, statusCode: httpResponse.statusCode});
                    }
                    else if (httpResponse.statusCode === 404) {
                        callback({error: "not a valid request", statusCode: httpResponse.statusCode});
                    }
                    else {

                        ShopwaveConnectManager.prototype.validateToken.call(parentInstace, httpResponse, function (responseObject) {

                            if (responseObject.error === true)
                            {
                                /* Token is expired , request new token */
                                req.body.grantType = "refresh_token"
                                ShopwaveConnectManager.prototype.requestToken.call(parentInstace, req, function (tokenResponseObject) {

                                    if (tokenResponseObject.error === true) {
                                        callback({error: {'message': 'cant refresh token'}});
                                    }
                                    else {
                                        httpRequestBuilder.makeCustomApiRequest(objHttpRequest, parentInstace.getConfig().displayErrorLog, function (resp) {
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getProductComponent: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/product/component',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    postProductComponent: function(req, res, headers, postBody, callback)
    {
        var objHttpRequest = {
            headers: {},
            url: '/product/component',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try
        {
            objHttpRequest.postBody['productComponents'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
        }
        catch (exception)
        {
            console.log("postBodyResponse: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param headers
     * @param productComponentIds (should be a string)
     * @param productComponentIIds (should be a string)
     * @param callback
     */
    deleteProductComponent: function(req, res, options, productComponentIds, productComponentIIds, callback)
    {
        var objHttpRequest = {
            headers: {},
            url: '/product/component',
            method: 'DELETE'
        };



        if(productComponentIds !== undefined && productComponentIds !== null)
        {
            objHttpRequest.headers['productComponentIds'] = productComponentIds.toString();
        }
        else
        {
            console.log(options, productComponentIds, productComponentIIds);
            callback({error: "no productComponentIds supplied, required or productComponentIds is not a valid array"})
        }

        if(productComponentIIds !== undefined && productComponentIIds !== null && productComponentIIds.length>0)
        {
            objHttpRequest.headers['productComponentInstanceIds'] = productComponentIIds.toString();
        }

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getEmployee: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/employee',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    postEmployee: function(req, res, headers, postBody, callback){
        var objHttpRequest = {
            headers: {},
            url: '/employee',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try
        {
            objHttpRequest.postBody['employees'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
        }
        catch (exception)
        {
            console.log("postBodyResponse: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },
    updateUser: function(req, res, headers, postBody, callback){
        var objHttpRequest = {
            headers: {},
            url: '/user',
            method: 'PUT'
        };

        objHttpRequest.postBody = {};

        try
        {
            objHttpRequest.postBody['user'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }
        catch (exception)
        {
            console.log("postBodyResponse: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option];
                }
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },
    postMerchant: function(req, res, headers, postBody, callback){
        var objHttpRequest = {
            headers: {},
            url: '/merchant',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try
        {
            objHttpRequest.postBody['merchants'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }
        catch (exception)
        {
            console.log("postBodyResponse: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
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

        if(options !== null){
            for(var option in options){
                if(options.hasOwnProperty(option) !== undefined){
                    //objHttpRequest.headers[option] = options[option];
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },
    postCategory: function(req, res, headers, postBody, callback)
    {
        var objHttpRequest = {
            headers: {},
            url: '/category',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try
        {
            objHttpRequest.postBody['categories'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }
        catch (exception)
        {
            console.log("postBodyResponse: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    deleteCategory: function(req, res, catIds, callback)
    {
        var objHttpRequest = {
            headers: {},
            url: '/category',
            method: 'DELETE'
        };

        if(catIds !== undefined)
        {
            objHttpRequest.headers['categoryId'] = catIds;
        }
        else
        {
            callback({error: "no categoryId supplied, required"})
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined)
                {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    postStore: function(req, res, headers, postBody, callback){
        var objHttpRequest = {
            headers: {},
            url: '/store',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try
        {
            objHttpRequest.postBody['stores'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }
        catch (exception)
        {
            console.log("postBodyResponse: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param headers
     * @param storeIds (comma seperated productId or Ids)
     * @param callback
     */
    deleteStore: function(req, res, storeIds, callback){

        var objHttpRequest = {
            headers: {},
            url: '/store',
            method: 'DELETE'
        };

        if(storeIds !== undefined)
        {
            objHttpRequest.headers['storeId'] = storeIds;
        }
        else
        {
            callback({error: "no storeId supplied, required"})
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

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    postPromotion: function(req, res, headers, postBody, callback){

        var objHttpRequest = {
            headers: {},
            url: '/promotion',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try{
            objHttpRequest.postBody = JSON.stringify(postBody);
        }catch (exception){
            console.log("postLogException: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
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

        if(options !== null) {
            for(var option in options){
                if(options.hasOwnProperty(option) !== undefined){
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
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
            url: '/report',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param options(tag, object, identifier) these are required params
     * @param callback
     */
    getLog: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/log',
            method: 'GET'
        };

        options["x-accept-version"] = "0.5";

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     * @param req
     * @param res
     * @param headers (tag, object, identifier) these are required params
     * @param postBody
     * @param callback
     */
    postLog: function(req, res, headers, postBody, callback){

        var objHttpRequest = {
            headers: {},
            url: '/log',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try{
            objHttpRequest.postBody = JSON.stringify(postBody);
        }catch (exception){
            console.log("postLogException: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param headers
     * @param postBody (should be a valid json Object)
     * @param callback
     */
    postProduct: function(req, res, headers, postBody, callback){

        var objHttpRequest = {
            headers: {},
            url: '/product',
            method: 'POST'
        };

        objHttpRequest.postBody = {
            "products" : {}
        };

        try{
            objHttpRequest.postBody['products'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }catch (exception){
            console.log("stringFY: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;// products{}
        //console.log("-", req.objHttpRequest);
        this.httpRequest(req, res, callback);
    },

    /**
     *
     * @param req
     * @param res
     * @param headers
     * @param productIds (comma seperated productId or Ids)
     * @param callback
     */
    deleteProduct: function(req, res, options, productIds, callback){

        var objHttpRequest = {
            headers: {},
            url: '/product',
            method: 'DELETE'
        };

        if(productIds !== undefined)
        {
            objHttpRequest.headers['productId'] = productIds;
        }
        else
        {
            callback({error: "no productId supplied, required"})
        }

        if(options !== undefined || options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     * Function gets supplier list or if supplierIds param is passed in header will get
     * supplier by Id
     * @param req
     * @param res
     * @param options
     * @param callback
     */
    getSupplier: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/supplier',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     * Function add edits supplier , to edit supplier pass id in supplier object
     * e.g add supplier object:
     *  {
     *       "0": {
     *           "name": "TEST1 Supplier",
     *           "description": null,
     *           "companyNumber": 9990999,
     *           "vatNumber": null,
     *           "deleteDate": null
     *       }
     *   }
     * @param req
     * @param res
     * @param headers
     * @param postBody
     * @param callback
     */
    postSupplier: function(req, res, headers, postBody, callback){

        var objHttpRequest = {
            headers: {},
            url: '/supplier',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try{
            objHttpRequest.postBody['supplier'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }catch (exception){
            console.log("stringFY: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     * Get all supplier store list,
     * optional params supplierIds if provided will get supplierStore by supplierId
     * @param req
     * @param res
     * @param options
     * @param callback
     */
    getSupplierStore: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/supplier/store',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    /**
     * add update supplier for supplied supplierId
     *
     *  "0":{
     *     "supplierId": 80,
     *       "lat": 333,
     *       "lng": 333,
     *       "addressLine1": "Tower HIll Bridge",
     *       "addressLine2": "Western Street",
     *       "addressLine3": null,
     *       "phoneNumber": "998 89 988 222",
     *       "city": "Cardiff",
     *       "postcode": "SE1 9EP"
     *  }
     *
     * @param req
     * @param res
     * @param headers
     * @param postBody
     * @param callback
     */
    postSupplierStore: function(req, res, headers, postBody, callback){

        var objHttpRequest = {
            headers: {},
            url: '/supplier/store',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try{
            objHttpRequest.postBody['supplierStores'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }catch (exception){
            console.log("stringFY: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getInvoice: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/invoice',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    postInvoice: function(req, res, headers, postBody, callback){

        var objHttpRequest = {
            headers: {},
            url: '/invoice',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try{
            objHttpRequest.postBody['invoices'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }catch (exception){
            console.log("stringFy: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    postReconciliate: function(req, res, headers, postBody, callback){
        var objHttpRequest = {
            headers: {},
            url: '/stock/reconcile',
            method: 'POST'
        };

        objHttpRequest.postBody = {};

        try{
            if(postBody !== undefined)
            {
                if(postBody.products !== undefined)
                {
                    for(var itemId in postBody.products)
                    {
                        if(postBody.products[itemId].note !== undefined &&
                            postBody.products[itemId].note !== null &&
                            typeof postBody.products[itemId].note === "object")
                        {
                            postBody.products[itemId].note = JSON.stringify(postBody.products[itemId].note);
                        }
                    }
                }

            }
            objHttpRequest.postBody['stockReconcile'] =  postBody;
            objHttpRequest.postBody = JSON.stringify(objHttpRequest.postBody);
            //console.log(JSON.parse(objHttpRequest.postBody));
        }catch (exception){
            console.log("stringFy: ", exception);
        }

        if(headers !== undefined || headers !== null)
        {
            for(var header in headers){
                if(headers.hasOwnProperty(header) !== undefined){
                    objHttpRequest.headers[header] = headers[header];
                }
            }
        }

        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    },

    getStockLevels: function(req, res, options, callback){

        var objHttpRequest = {
            headers: {},
            url: '/stock',
            method: 'GET'
        };

        if(options !== null) {
            for (var option in options) {
                if (options.hasOwnProperty(option) !== undefined) {
                    objHttpRequest.headers[option] = options[option].constructor === Array ? options[option].join() : options[option];
                }
            }
        }
        req.objHttpRequest = objHttpRequest;
        this.httpRequest(req, res, callback);
    }

}