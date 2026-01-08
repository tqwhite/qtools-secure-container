#!/usr/bin/env node
'use strict';

const moduleName = __filename.replace(__dirname + '/', '').replace(/.js$/, ''); //this just seems to come in handy a lot

const qt = require('qtools-functional-library');
//console.dir(qt.help());

const wrapGen = require('./lib/wrap');
const unwrapGen = require('./lib/unwrap');
const swapKeyGen = () => ({});

const crypto = require('crypto');
const path = require('path');
const fs=require('fs');

//START OF moduleFunction() ============================================================

const moduleFunction = function(args, callback) {
	const { privateKey, publicKey, newKey } = args;
	let { rsaKeyPem, forceDitto } = args;
	forceDitto=true;

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

	if (rsaKeyPem) {
		// rsaKeyPem is a PEM string (private or public key)
		wrapFile = wrapGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir }).wrapFile;
		unwrapFile = unwrapGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir })
			.unwrapFile;
		swapKey = swapKeyGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else if (!rsaKeyPem && privateKey) {
		// privateKey is a PEM string
		rsaKeyPem = privateKey;
		wrapFile = wrapGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir }).wrapFile;
		unwrapFile = unwrapGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir })
			.unwrapFile;
		swapKey = swapKeyGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else if (!rsaKeyPem && publicKey) {
		// publicKey is a PEM string - can only wrap, not unwrap
		rsaKeyPem = publicKey;
		wrapFile = wrapGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir }).wrapFile;
		unwrapFile = noPrivateKeyWrap; //can wrap() a thing but not unwrap() it w/o private key
		swapKey = swapKeyGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir, newKey })
			.swapKey;
	} else if (!rsaKeyPem) {
		// Generate new key pair using native crypto
		const { privateKey: newPrivateKey, publicKey: newPublicKey } = crypto.generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: { type: 'spki', format: 'pem' },
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
		});
		rsaKeyPem = newPrivateKey;
		wrapFile = wrapGen({
			rsaKeyPem, forceDitto,
			secureContainerWorkingDir,
			returnNewKeys: true
		}).wrapFile;
		unwrapFile = unwrapGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir })
			.unwrapFile;
		swapKey = swapKeyGen({ rsaKeyPem, forceDitto, secureContainerWorkingDir, newKey })
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

