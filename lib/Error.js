var Error = function (){};

Error.prototype = {

    logErrorAuto: function (errorMessage, isEnabled) {
        if(isEnabled === true)
        {
            if(typeof errorMessage === 'object')
            {
                var tempMessage = "";
                for(var key in errorMessage)
                {
                    tempMessage += key+" - "+errorMessage[key]+" | ";
                }
                console.log(tempMessage);
                console.log("=====================================");
            }
            else
            {
                console.log(errorMessage);
                console.log("=====================================");
            }
        }
    },

    logError: function(errorMessage, isEnabled)
    {
        if(isEnabled === true)
        {
            console.log(errorMessage);
            console.log("=====================================");
        }
    }
};

module.exports = new Error();