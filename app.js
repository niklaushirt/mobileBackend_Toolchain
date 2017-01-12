/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');

// -----------------------------
// SETUP WATSON SERVICES
// -----------------------------
var STT_CREDENTIALS = {
    username: '3630d2f1-597d-43d1-b6be-50b21c8f3702',
    password: 'Ff7tBWQlAx5T',
};

//var speechToText = watson.speech_to_text(STT_CREDENTIALS);
var speech_to_text = new SpeechToTextV1(STT_CREDENTIALS);



// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();


// -----------------------------
// GET TRADE SOLUTION
// -----------------------------
app.get('/getWatsonSolution', function (req, res) {

    var thrGain = req.query.gain;
    var theQty = req.query.qty;
    var theRisk = req.query.risk;

    console.log("Req Gain:" + thrGain);
    console.log("Req Qty:" + theQty);
    console.log("Req Risk:" + theRisk);

    //Example Solution    
    var actResult = '{ \"solution\": [{ \"Name\": \"OSPHX\", \"Gain\": \"6.46\", \"Risk\": \"0.3\", \"Buy\": \"18.09\", \"Quantity\": \"49863.63\" }, { \"Name\": \"OBIOX\", \"Gain\": \"7.48\", \"Risk\": \"0.14\", \"Buy\": \"19.74\", \"Quantity\": \"65111.66\" }, { \"Name\": \"OSICX\", \"Gain\": \"3.1\", \"Risk\": \"0.65\", \"Buy\": \"5.14\", \"Quantity\": \"298661.23\" }, { \"Name\": \"OMHTX\", \"Gain\": \"0.4\", \"Risk\": \"0.91\", \"Buy\": \"2.18\", \"Quantity\": \"55545.88\" }, { \"Name\": \"OICNX\", \"Gain\": \"1.9\", \"Risk\": \"0.97\", \"Buy\": \"1.01\", \"Quantity\": \"63434.82\" }, { \"Name\": \"OLTMX\", \"Gain\": \"2.1\", \"Risk\": \"0.74\", \"Buy\": \"2.6\", \"Quantity\": \"41325.69\" }] }';
    var jsonObj = JSON.parse(actResult);
    var jsonArray = jsonObj.solution

    //Delete non-fitting elements
    for (var myKey in jsonObj.solution) {
        var actGain = jsonObj.solution[myKey].Gain;
        var actQty = jsonObj.solution[myKey].Quantity;
        var actRisk = jsonObj.solution[myKey].Risk;

        if ((actGain < thrGain) || (actQty < theQty) || (actRisk > theRisk)) {
            console.log("Remove:" + myKey + ", Name:" + jsonObj.solution[myKey].Gain);
            delete jsonObj.solution[myKey];
        }
    }

    for (var myKey in jsonObj.solution) {
        var actGain = jsonObj.solution[myKey].Gain;
        console.log("key:" + myKey + ", Name:" + jsonObj.solution[myKey].Name + ":" + actGain);
    }

    //Construct Return String
    var solutionString = ""

    for (var myKey in jsonObj.solution) {
        solutionString = solutionString + jsonObj.solution[myKey].Name + "/";
    }
    solutionString = solutionString + "@@@";


    for (var myKey in jsonObj.solution) {
        solutionString = solutionString + jsonObj.solution[myKey].Gain + "/";
    }
    solutionString = solutionString + "@@@";

    for (var myKey in jsonObj.solution) {
        solutionString = solutionString + "" + jsonObj.solution[myKey].Gain + "@" + jsonObj.solution[myKey].Risk + "@" + jsonObj.solution[myKey].Buy + "@" + jsonObj.solution[myKey].Quantity + "/";
    }
    solutionString = solutionString + "@@@";

    for (var myKey in jsonObj.solution) {
        solutionString = solutionString + jsonObj.solution[myKey].Risk + "/";
    }
    console.log("Solution:" + solutionString);

    //console.log('Selected GAIN:' + actGain);
    res.send(solutionString);
});



// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// CUSTOMER CARE API 
// -------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// -----------------------------
// HANDLE COMPLAINT
// -----------------------------
// Handle the form POST containing an audio file and return transcript (from mobile)
app.post('/complaints', function (req, res) {

    console.log("BEGIN REQUEST-------------------------------------------------------\r\n\r\n");

    console.log("Transferring Audio from Phone");
    
    console.log("      TEST: " + req.stringify);
    
    var file = req.files.audio;
    var readStream = fs.createReadStream(file.path);
    console.log("      Opened stream for audio file: " + file.path);

    var params = {
        audio: readStream,
        content_type: 'audio/l16; rate=16000; channels=1',
        continuous: "true"
    };

    //console.log("Writing stream to audio file: " + file.path);

    speech_to_text.recognize(params, function (err, response) {

        readStream.close();

        console.log("      Closed stream for audio file: " + file.path + "\r\n\r\n");

        if (err) {
            return res.status(err.code || 500).json(err);
        } else {
            var result = {};
            if (response.results.length > 0) {
                var finalResults = response.results.filter(isFinalResult);

                if (finalResults.length > 0) {
                    result = finalResults[0].alternatives[0];

                    console.log("What I understood:\r\n" + JSON.stringify(result.transcript) + "\r\n\r\n");
                    var transcription = JSON.stringify(result.transcript);
                    
                    //Kick off Backend Treatment in NodeRed
                    var requestify = require('requestify');

                    console.log("Sent to Analysis");

                    requestify.get('http://noderedprod.mydemo.center/complaint?text=' + encodeURIComponent(transcription))
                        .then(function (response) {
                            // Get the response body (JSON parsed or jQuery object for XMLs)
                            response.getBody();
                            console.log("Request Taxonomy: " + JSON.stringify(response) + "\r\n\r\n");
                            console.log("END REQUEST-------------------------------------------------------\r\n\r\n\r\n\r\n\r\n\r\n");
                        });
                }
            }
            return res.send(result.transcript);
        }
    });
});


function isFinalResult(value) {
    return value.final == true;
}



// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
