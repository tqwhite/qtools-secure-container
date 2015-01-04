"use strict";
var qtools = require('qtools');
qtools = new qtools(module);

var express = require('express');
var app = express();

//SET UP APPLICATION =======================================================

var configPath=process.env.SUPERSECRETCONFIGPATH;
if (!configPath){
	qtools.die("there must be an environment variable pointing a folder containing localEnvironment.js and secretConfig.js named SuperSecretConfigPath");
}

var localEnvironment = require(configPath+'localEnvironment.js');
global.localEnvironment = new localEnvironment({
	appName: 'secretserver'
});

// global.localEnvironment.log.info({
// 	startup: "STARTING SecretServer==================== "
// });

var config = require(configPath+'secretConfig.js');
config = new config();


//INITIALIZE =======================================================

var router = express.Router();
app.use('/', router);

//START =======================================================

//router.use(function(req, res, next) {});

//START ROUTING FUNCTION =======================================================

// router.get(new RegExp('/'), function(req, res, next) {
// }); //end of main GET process ---------------------------------------------------

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

