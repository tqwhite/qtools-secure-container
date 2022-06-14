#!/usr/bin/env node
'use strict';

const moduleName = __filename.replace(__dirname + '/', '').replace(/.js$/, ''); //this just seems to come in handy a lot

const qt = require('qtools-functional-library');
//console.dir(qt.help());

const wrapGen = require('./lib/wrap');
const unwrapGen = require('./lib/unwrap');
const swapKeyGen = () => ({});

const nodeRsa = require('node-rsa');

//START OF moduleFunction() ============================================================

const moduleFunction = function(args, callback) {

	const { privateKey, publicKey, newKey } = args;
	let {nodeRsaKey}=args;

	const noPrivateKeyWrap = (args, callback) => {
		callback(
			'No private key supplied to qtools-secure-container. unwrap() not allowed.'
		);
	};

	let wrap;
	let unwrap;
	let swapKey;
	let err = '';

	if (nodeRsaKey) {
		wrap = wrapGen({ nodeRsaKey }).wrap;
		unwrap = unwrapGen({ nodeRsaKey }).unwrap;
		swapKey = swapKeyGen({ nodeRsaKey, newKey }).swapKey;
	} else if (!nodeRsaKey && privateKey) {
		nodeRsaKey = nodeRsa(privateKey);
		wrap = wrapGen({ nodeRsaKey }).wrap;
		unwrap = unwrapGen({ nodeRsaKey }).unwrap;
		swapKey = swapKeyGen({ nodeRsaKey, newKey }).swapKey;
	} else if (!nodeRsaKey && publicKey) {
		nodeRsaKey = nodeRsa(publicKey);
		wrap = wrapGen({ nodeRsaKey }).wrap;
		unwrap = noPrivateKeyWrap; //can wrap() a thing but not unwrap() it w/o private key
		swapKey = swapKeyGen({ nodeRsaKey, newKey }).swapKey;
	} else if (!nodeRsaKey) {
		nodeRsaKey = nodeRsa({ b: 2048 });
		wrap = wrapGen({ nodeRsaKey, returnNewKeys: true }).wrap;
		unwrap = unwrapGen({ nodeRsaKey }).unwrap;
		swapKey = swapKeyGen({ nodeRsaKey, newKey }).swapKey;
	} else {
		err = 'No keys supplied to qtools-secure-container';
	}

	callback(err, { wrap, unwrap, swapKey });
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
//module.exports = new moduleFunction();
//moduleFunction().workingFunction().qtDump();

