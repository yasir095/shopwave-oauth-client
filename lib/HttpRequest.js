/**
 * Created by yasirmahmood on 27/01/2014.
 */
var request = require('request');

/**
 *
 * @param req object looks like this
 * {
 *      apiServerUrl : 'http://......'
 *      body: {
 *          method: GET or POST
 *          headers: {}
 *      }
 *      route: {'path': '/example'}
 * }
 * @param callback
 */
exports.makeCustomApiRequest = function(req, callback){

    try{
        req.body.postBody =  JSON.parse(req.body.postBody);
    }catch(exception){
        //console.log(exception);
    }

    var pathName = "", headers = {}, method;

    method = (typeof req.body.method !== 'undefined') ? req.body.method : "GET";    //default method Get

    if(typeof req.route.path !== 'undefined'){
        pathName = req.route.path;
    }

    headers.accept = "application/json";


    for(var headerId in req.body.headers)
    {
        if(req.body.headers.hasOwnProperty(headerId)){
            headers[headerId] = req.body.headers[headerId];
        }
    }

    headers.Authorization = 'OAuth '+ req.body.accessToken;
    //headers['accept-encoding'] = "gzip, deflate";

//    var postData = (typeof req.body.postBody !== 'undefined') ? req.body.postBody : {};
//    postData = (typeof req.body.postBody !== 'undefined') ? req.body.postBody : {};

    var requestObject = {};

    if(method == "GET"){
        requestObject = {
            url: req.body.apiServerUrl+pathName,
            headers: headers,
            method: method
        };
    }else{
        requestObject = {
            url: req.body.apiServerUrl+pathName,
            headers: headers,
            form: {
                postBody: JSON.stringify(req.body.postBody)
            },
            method: method
        };
    }

    request(requestObject, function (error, response, body) {
        if(error){
            callback({'error': error});
        }else
        {
            callback(response);
        }
    });
};