shopwave-oauth-client
=====================

A basic shopwave oauth client for node.js . This API allows users to authenticate against Shopwave OAUTH Server. It also has support for API calls, that can be used to get user data & make other GET/POST api calls.

Installation
=====================

```
$ npm install shopwave-oauth-client
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
***

## GET API CALLS

* Get products

```javascript

//optional header params.

var options = {
    productIds : 1,2,3,4,66,
    active: true,
    deleted: false,
    storeId: 1
}

req.oAuthClient.getProduct(req, res, options, function(responseObject)
    {
        var products = JSON.parse(responseObject.body);
        console.log(products);
    });

```
* Get User
* Get Basket
* Get Status
* Get Merchant
* Get Category
* Get Store
* Get Promotion
* Get PromotionCode
* Get BasketReport
* Get Log

---
## POST API CALLS

* Post Product

```javascript
var options = null;
var requestParams = {
  "products": {
    "0": {
      "id": "18",
      "name": "Earl Grey Brewed Tea",
      "details": "Earl Grey includes some of the world",
      "price": "107.5",
      "barcode": "75645464655",
      "vatPercentage": "0.20"
    }
  }
}

req.oAuthClient.postProduct(req, res, options, requestParams, function(response){
    if(response.error == null || response.error === undefined)
    {
        res.send({message: "Product "+statusParams+"d successfully"});
    }else{
        exceptionHandler.logError("onProductDelete: ", response.error);
        res.send({error: "Something went wrong, please try again later"});
    }
});
```