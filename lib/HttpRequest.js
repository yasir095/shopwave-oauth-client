/**
 * Created by yasirmahmood on 27/01/2014.
 */
var request = require('request'),
    zlib = require('zlib'),
    FormData = require('form-data'),
    fs = require('fs');

cError = require('./Error');

/**
 *
 * @param req object looks like this
 * {
 *      apiServerUrl : 'http://......',
 *      accessToken: 'your access token',
 *      body{
 *          postBody: {
 *              postparams here
 *          }
 *      },
 *      headers: {},
 *      method: GET or POST,
 *      route: {'path': '/example'}
 * }
 * @param callback
 */
exports.makeCustomApiRequest = function(req, logError, callback){


    try{
        req.body.postBody =  JSON.parse(req.body.postBody);
    }catch(exception){
        //console.log(exception);
    }

    var pathName = "", headers = {}, method;

    method = (typeof req.method !== 'undefined') ? req.method : "GET";    //default method Get

    if(typeof req.route.path !== 'undefined'){
        pathName = req.route.path;
    }

    headers.accept = "application/json";


    for(var headerId in req.headers)
    {
        if(req.headers.hasOwnProperty(headerId)){
            headers[headerId] = req.headers[headerId];
        }
    }

    headers.Authorization = 'OAuth '+ req.accessToken;
    //headers['accept-encoding'] = "gzip, deflate";

//    var postData = (typeof req.postBody !== 'undefined') ? req.postBody : {};
//    postData = (typeof req.postBody !== 'undefined') ? req.postBody : {};

    var requestObject = {};

    if(method == "GET"){
        requestObject = {
            url: req.apiServerUrl+pathName,
            headers: headers,
            method: method
        };
    }
    else
    {
        requestObject = {
            url: req.apiServerUrl+pathName,
            headers: headers,
            form: {
                postBody: JSON.stringify(req.body.postBody)
            },
            method: method
        };
    }

    cError.logError(requestObject, logError);

    var startTime = new Date();
    makeWebRequest(requestObject, function(response)
    {
        var statusCode;
        var noContent = 204;    //no Content response, will have no body but statusCode will be 204
        var unauthorized = 401;
        var contentReset = 205;
        var requestProcessed = false;

        //cError.logError("Body: "+response.data.body, logError);

        cError.logError("Response:- "+response.data.statusCode+" | API RT: "+(new Date()-startTime)+"ms", logError);
        //cError.logError("REsponseBody: "+response.data.body, logError);
        try
        {
            if(response.data.statusCode>=400)
            {
                cError.logError("Body: "+response.data.body, logError);
            }

            statusCode = response.data.statusCode;
            if(response.data.statusCode === noContent){
                requestProcessed = true;
                callback(response.data);
            }
            else if(response.data.statusCode === unauthorized){
                requestProcessed = true;
                callback(response.data);
            }
            else if(response.data.statusCode === contentReset)
            {
                requestProcessed = true;
                callback(response.data);
            }
            else
            {
                var parsedResponse = JSON.parse(response.data.body);
                if(parsedResponse.api.message !== undefined && parsedResponse.api.message['errors'] !== undefined && response.data.statusCode >= 400)
                {
                    for(var errorCode in parsedResponse.api.message['errors'])
                    {
                        //console.log("errorCod:", parsedResponse.api.message['errors'][errorCode]);
                        if(parsedResponse.api.message['errors'].hasOwnProperty(errorCode) !== undefined && parsedResponse.api.message['errors'][errorCode] !== undefined && errorCode>900 && response.data.errorCode <=909)
                        {
                            cError.logError("OAuth related errors", logError);
                            //manage this error in HttpRequest. most probably its a token error, check and renew token.
                            //response will be passed to the handling function as it is and wont be handled here.
                        }
                        else
                        {
                            response.error = true;
                        }
                        break;
                    }
                }
            }
        }
        catch(ex)
        {
            if(response.data)
                response.error = true;
        }

        if(!requestProcessed)
        {
            if(response.error!== undefined && response.error != null)
            {
                callback({'error': response.error, 'statusCode': statusCode});
            }
            else
            {
                callback(response.data);
            }
        }
        //else request allready sent
    });
};

/**
 * Function make web request  including gzip request and uncompressed the gzip if required.
 * pass encoding as gzip to make gzip request. gzip response will be automatically parsed and returned as normal
 */
function makeWebRequest(requestObject, callback){

    var req = request.get(requestObject);

    req.on('response', function(res) {
        var chunks = [];
        res.on('data', function(chunk) {
            chunks.push(chunk);
        });

        res.on('end', function() {
            var buffer = Buffer.concat(chunks);
            var encoding = res.headers['content-encoding'];
            if (encoding == 'gzip') {
                //console.log("responseType:", encoding);
                zlib.gunzip(buffer, function(err, decoded) {
                    res.body = decoded.toString();
                    callback({error: err, data: res});
                });
            } else if (encoding == 'deflate') {
                zlib.inflate(buffer, function(err, decoded) {
                    res.body = decoded.toString();
                    callback({error: err, data: res});
                });
            } else {
                res.body = buffer.toString();
                callback({data: res});
            }
        });
    });

    req.on('error', function(err) {
        callback({error: err});
    });
}

/**
 * upload files to server..
 * required params : {
 *      apiServerUrl: 'api.merchantstack.com'
 *      headers: {},
 *      method:{},
 *      route: {'path': '/uploader'}  //required
 *      body{
 *          postBody{
 *              your post params here
 *          }
 *      },
 *      filePath: 'image path optional'
 * }
 * from fs.createReadStream('./uploads/image2.png'));//path.join(__dirname, "image.png"))
 * @param req
 * @param callback
 */
exports.multipartFileUpload = function(req, logError, callback){

    var headers = {};
    var form = new FormData();

    if(req.filePath !== undefined)
    {
        if(req.apiServerUrl !== undefined && req.route !== undefined && req.route.path !== undefined)
        {
            headers.accept = "application/json";
            headers.Authorization = 'OAuth '+ req.accessToken;


            for(var key in req.headers){
                headers[key] = req.headers[key];
            }

            form.append("postBody", JSON.stringify(req.body.postBody));
            form.append("file", fs.createReadStream(req.filePath));

            form.getLength(function(err, length){
                if (err)
                {
                    callback({error: err});
                }
                else
                {
                    var r = request.put(req.apiServerUrl+req.route.path, function(err, rs, body)
                    {
                        callback({error:err, data: rs, response: body});
                    });
                    r._form = form;
                    r.setHeader('content-length', length);
                    r.setHeaders(headers);
                }
            });

        }
        else
        {
            console.log("required params missing, check if these params are supplied req.apiServerUrl, req.route.path required");
            callback({error: true});
        }
    }
    else
    {
        console.log("fsReadStream not supplied, looking in req.filePath");
        callback({error: true});
    }
};