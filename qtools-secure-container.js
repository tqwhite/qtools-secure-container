#!/usr/bin/env node
'use strict';

const moduleName = __filename.replace(__dirname + '/', '').replace(/.js$/, ''); //this just seems to come in handy a lot

const qt = require('qtools-functional-library');
//console.dir(qt.help());

const wrapGen = require('./lib/wrap');
const unwrapGen = require('./lib/unwrap');
const swapKeyGen = () => ({});

const nodeRsa = require('node-rsa');
const path = require('path');
const fs=require('fs');

//START OF moduleFunction() ============================================================

const moduleFunction = function(args, callback) {
	const { privateKey, publicKey, newKey } = args;
	let { nodeRsaKey, forceDitto } = args;
	forceDitto=true
	const noPrivateKeyWrap = (args, callback) => {
		callback(
			'No private key supplied to qtools-secure-container. unwrap() not allowed.'
		);
	};

	let wrapFile;
	let unwrapFile;
	let swapKey;
	let err = '';

	const secureContainerWorkingDir = path.join('/tmp', 'secureContainerTemp');
	fs.mkdirSync(secureContainerWorkingDir, {recursive:true});

	if (nodeRsaKey) {
		wrapFile = wrapGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir }).wrapFile;
		unwrapFile = unwrapGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir })
			.unwrapFile;
		swapKey = swapKeyGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else if (!nodeRsaKey && privateKey) {
		nodeRsaKey = nodeRsa(privateKey);
		wrapFile = wrapGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir }).wrapFile;
		unwrapFile = unwrapGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir })
			.unwrapFile;
		swapKey = swapKeyGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else if (!nodeRsaKey && publicKey) {
		nodeRsaKey = nodeRsa(publicKey);
		wrapFile = wrapGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir }).wrapFile;
		unwrapFile = noPrivateKeyWrap; //can wrap() a thing but not unwrap() it w/o private key
		swapKey = swapKeyGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else if (!nodeRsaKey) {
		nodeRsaKey = nodeRsa({ b: 2048 });
		wrapFile = wrapGen({
			nodeRsaKey, forceDitto,
			secureContainerWorkingDir,
			returnNewKeys: true
		}).wrapFile;
		unwrapFile = unwrapGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir })
			.unwrapFile;
		swapKey = swapKeyGen({ nodeRsaKey, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else {
		err = 'No keys supplied to qtools-secure-container';
	}

	callback(err, { wrapFile, unwrapFile, swapKey });
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
//module.exports = new moduleFunction();
//moduleFunction().workingFunction().qtDump();

