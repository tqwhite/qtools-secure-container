#!/usr/bin/env node
'use strict';

const moduleName = __filename.replace(__dirname + '/', '').replace(/.js$/, ''); //this just seems to come in handy a lot

const qt = require('qtools-functional-library');
//console.dir(qt.help());

const asynchronousPipePlus = new require('qtools-asynchronous-pipe-plus')();
const pipeRunner = asynchronousPipePlus.pipeRunner;
const taskListPlus = asynchronousPipePlus.taskListPlus;

const fs = require('fs');
const path = require('path');

const { exec } = require('child_process');
const os = require('os');

const crypto = require('crypto');

//START OF moduleFunction() ============================================================

const moduleFunction = function({ rsaKeyPem, forceDitto }) {
	//===================================================================================
	// UNWRAP DATA

	const decryptData = (
		{
			rsaKeyPem,
			fileReadResult,
			symmetricKeyEncrypted,
			outputName,
			secureContainerWorkingDir
		},
		callback
	) => {
		const taskList = new taskListPlus();

		//-----------------------------------------------------------------------------------
		// UNPACK AND CONVERT

		taskList.push((args, next) => {
			const { rsaKeyPem, forceDitto, fileReadResult, symmetricKeyEncrypted } = args;

			const localCallback = (err, decryptedData) => {
				next(err, { ...args, decryptedData });
			};

			// Decrypt the symmetric key + IV bundle using RSA private key
			const encryptedKeyBuffer = Buffer.from(symmetricKeyEncrypted.toString('utf8'), 'base64');

			const decryptedKeyAndIv = crypto.privateDecrypt(
				{
					key: rsaKeyPem,
					padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
					oaepHash: 'sha256'
				},
				encryptedKeyBuffer
			);

			// Extract symmetric key (first 32 bytes) and IV (next 16 bytes)
			const symmetricKey = decryptedKeyAndIv.subarray(0, 32);
			const iv = decryptedKeyAndIv.subarray(32, 48);

			// Use createDecipheriv with explicit IV (required in modern Node)
			const decipher = crypto.createDecipheriv('aes-256-cbc', symmetricKey, iv);

			let decryptedData = decipher.update(fileReadResult, 'hex', 'utf8');
			decryptedData += decipher.final('utf8');

			localCallback('', decryptedData);
		});

		taskList.push((args, next) => {
			const { decryptedData } = args;
			const localCallback = (err, unBase64) => {
				next(err, { ...args, unBase64 });
			};

			const unBase64 = Buffer.from(decryptedData.toString('utf8'), 'base64');

			localCallback('', unBase64);
		});

		//-----------------------------------------------------------------------------------
		// WRITE TEMP FILE RESULTS

		taskList.push((args, next) => {
			const { unBase64 } = args;
			const { outputName } = args;

			const localCallback = (err, zipFilePath) => {
				if (err) {
					next(err, args);
					return;
				}
				next(err, { ...args, zipFilePath });
			};
			const zipFilePath = path.join(
				secureContainerWorkingDir,
				path.basename(outputName) + '.zip'
			);

			fs.writeFile(zipFilePath, unBase64, (error, stdout, stderr) => {
				if (error) {
					callback(error.message);
					return;
				}

				localCallback('', zipFilePath);
			});
		});

		//-----------------------------------------------------------------------------------
		// UPZIP FILE

		taskList.push((args, next) => {
			const { zipFilePath } = args;
			const { outputName } = args;
			const nameParts = path.parse(outputName);

			const unzipRawOutputDirPath = path.join(
				secureContainerWorkingDir,
				`unzipRawOutputDirPath_${Math.random()
					.toString()
					.replace(/^0*\./, '')}_${nameParts.name}`
			);

			const localCallback = err => {
				next(err, { ...args, unzipRawOutputDirPath });
			};

			const squeezeFlow = require('../squeeze-flow')();
			squeezeFlow.expand({ zipFilePath, unzipRawOutputDirPath, forceDitto }, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// DISCARD

		taskList.push((args, next) => {
			const { unzipRawOutputDirPath } = args;
			const fileList = fs.readdirSync(unzipRawOutputDirPath);

			const unpackedFileDataList = fileList.map(fileName => {
				const tmp = path.join(unzipRawOutputDirPath, fileName);
				return {
					fileName,
					contents: path.join(unzipRawOutputDirPath, fileName)
				};
			});

			next('', { ...args, unpackedFileDataList });
		});

		//-----------------------------------------------------------------------------------
		// REMOVE TEMP FILE

		taskList.push((args, next) => {
			const { zipFilePath } = args;
			const localCallback = err => {
				next(err, { ...args });
			};

			fs.rm(zipFilePath, { recursive: true }, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// HOIST PAYLOAD

		taskList.push((args, next) => {
			const { unzipRawOutputDirPath } = args;
			const { outputName } = args;
			const nameParts = path.parse(outputName);

			const localCallback = err => {
				next(err, { ...args, unzipOutputTempFilePath });
			};

			const payloadDirPath = path.join(unzipRawOutputDirPath, 'CONTAINER');

			const unzipOutputTempFilePath = path.join(
				secureContainerWorkingDir,
				`unzipOutputTempFilePath_${Math.random()
					.toString()
					.replace(/^0*\./, '')}_${nameParts.base}`
			); //this is the final file name
			fs.cp(
				payloadDirPath,
				unzipOutputTempFilePath,
				{ recursive: true },
				localCallback
			);
		});

		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = {
			rsaKeyPem, forceDitto,
			fileReadResult,
			symmetricKeyEncrypted,
			outputName
		};
		pipeRunner(taskList.getList(), initialData, (err, args) => {
			const { unpackedFileDataList, unzipOutputTempFilePath } = args;
			callback(err, {
				unpackedFileDataList,
				unzipOutputTempFilePath,
				operation: moduleName,
				isEncrypted: true
			});
		});
	};
	const unwrapFile = (
		{ inFilePath, outputDirPath, outputName },
		callback
	) => {};
	return { decryptData };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
