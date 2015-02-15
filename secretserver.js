"use strict";
var qtools = require('qtools');
qtools = new qtools(module);

var express = require('express');
var bodyParser = require("body-parser");
var app = express();

var fileManagerGenerator = require('fileManager');

//SET UP APPLICATION =======================================================

var configPath = process.env.SUPERSECRETCONFIGPATH;
if (!configPath) {
	qtools.die("there must be an environment variable pointing a folder containing localEnvironment.js and secretConfig.js named SuperSecretConfigPath");
}

var localEnvironment = require(configPath + 'localEnvironment.js');
global.localEnvironment = new localEnvironment({
	appName: 'secretserver'
});

// global.localEnvironment.log.info({
// 	startup: "STARTING SecretServer==================== "
// });

var config = require(configPath + 'secretConfig.js');
config = new config();

var secretStoragePath = config.secretStoragePath;


//INITIALIZE =======================================================

console.log('secretStoragePath=' + secretStoragePath + '\n');


var nameMaker = require('nameMaker');
nameMaker = new nameMaker({
	secretStoragePath: secretStoragePath
});

var router = express.Router();
app.use(bodyParser.json({
	extended: false
}));
app.use('/', router);

//START =======================================================

//router.use(function(req, res, next) {});

//START ROUTING FUNCTION =======================================================


router.get('/access', function(req, res, next) {
	console.log('\'get\' request from mastermind');
	console.log("req.body.codeName=");
	console.dir(req.body.codeName);


	var fileReader = new fileManagerGenerator({
		fileName: req.body.codeName,
		storageDirectoryPath: secretStoragePath
	})
	fileReader.getItForMe(function(err, result) {
		if (err) {
console.dir({'\n\n=-=== err =====':err});


			res.json({
				status: -1,
				message: err.message
			});
			return;
		}
		console.log('\n\n\got file data '+result.length+": "+result);

		res.json({
			status: 1,
			message: 'successful read',
			fileData: result
		});
	});

// 	res.json({
// 		hiddenSecretContent: "this isn't really a secret: work on server/receiving.js next"
// 	});
});

router.post('/access', function(req, res, next) {

	var fileName = req.body.codeName ? req.body.codeName : nameMaker.create();
	var fileWriter = new fileManagerGenerator({
		fileName: fileName,
		storageDirectoryPath: secretStoragePath
	})
	fileWriter.takeItAway(req.body.hiddenSecret, function(err, result) {
		if (err) {


			res.json({
				status: -1,
				message: err.message
			});
			return;
		}
		console.log('\n\n\'post\' received from mastermind ' + req.body.hiddenSecret);

		res.json({
			status: 1,
			message: 'successful save',
			codeName: fileName
		});
	});
});

//START ROUTE GROUP (ping) =======================================================

router.get('/ping', function(req, res, next) {

	res.json({
		status: 'hello from ping/get',
		body: req.body,
		query: req.query
	});
});

router.post('/ping', function(req, res, next) {
	res.json({
		status: 'hello from ping/post',
		body: req.body,
		query: req.query
	});
});

//START SERVER =======================================================

app.listen(config.port);

qtools.message('Magic happens on port ' + config.port);



