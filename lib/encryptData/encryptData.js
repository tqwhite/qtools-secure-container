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

const moduleFunction = function({ nodeRsaKey }) {
	// ===================================================================================
	//WRAP DATA TO DATA

	const encryptData = (args, callback) => {
		const {
			outputName,
			inFileData,
			inFilePath,
			nodeRsaKey,
			secureContainerWorkingDir
		} = args;
		const taskList = new taskListPlus();

		//-----------------------------------------------------------------------------------
		// COPY FILE TO WORK DIRECTORY WITH UNIQUE-IFIED NAME

		taskList.push((args, next) => {
			const { outputName, inFilePath } = args;
			const nameParts = path.parse(outputName);

			const secureContainerPath = path.join(
				secureContainerWorkingDir,
				`secureContainerPath_${Math.random()
					.toString()
					.replace(/^0*\./, '')}`
			);
			const workingSourceFilePath = path.join(
				secureContainerPath,
				'CONTAINER',
				`${nameParts.base}`
			);

			const localCallback = err => {
				next(err, { ...args, workingSourceFilePath, secureContainerPath });
			};

			fs.mkdirSync(path.dirname(workingSourceFilePath), { recursive: true });

			fs.cp(
				inFilePath,
				workingSourceFilePath,
				{ recursive: true },
				localCallback
			);
		});

		//-----------------------------------------------------------------------------------
		// ZIP FILE INPUT

		taskList.push((args, next) => {
			const { outputName, fileReadResult } = args;
			const { workingSourceFilePath, secureContainerPath } = args;

			const zipOutputFilePath = path.join(
				secureContainerWorkingDir,
				`zipOutputFilePath_${Math.random()
					.toString()
					.replace(/^0*\./, '')}`,
				outputName + '.zip'
			);  
			 const localCallback = (err, zipOutputFilePath) => {
				next(err, { ...args, zipOutputFilePath });
			};

			fs.mkdirSync(path.dirname(zipOutputFilePath), { recursive: true });
			const shellCommand = `ditto -ck --rsrc  '${secureContainerPath}' '${zipOutputFilePath}'`;

			exec(shellCommand).on('close', (error, stdout, stderr) => {
				if (error) {
					callback(stderr);
					return;
				}
				localCallback('', zipOutputFilePath);
			});
		});

		taskList.push((args, next) => {
			const { workingSourceFilePath } = args;
			const localCallback = err => {
				next(err, { ...args });
			};

			fs.rm(
				path.dirname(workingSourceFilePath),
				{ recursive: true },
				localCallback
			);
		});

		//-----------------------------------------------------------------------------------
		// READ ZIP FILE

		taskList.push((args, next) => {
			const { zipOutputFilePath } = args;
			const localCallback = (err, fileReadResult) => {
				next(err, { ...args, fileReadResult });
			};

			const fileData = fs.readFile(zipOutputFilePath, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// UNPACK AND CONVERT

		taskList.push((args, next) => {
			const { fileReadResult } = args;
			const localCallback = (err, sourceFileInBase64) => {
				next(err, { ...args, sourceFileInBase64 });
			};

			const sourceFileInBase64 = Buffer.from(fileReadResult.toString('base64'));

			localCallback('', sourceFileInBase64);
		});

		taskList.push((args, next) => {
			const { nodeRsaKey, sourceFileInBase64 } = args;

			const symmetricKey = crypto.randomBytes(32).toString('base64');

			const symmetricKeyEncrypted = nodeRsaKey
				.encrypt(symmetricKey)
				.toString('base64'); //or key.encryptPrivate()

			const cipher = crypto.createCipher('aes192', symmetricKey);
			let encryptedDataInBase64 = cipher.update(
				sourceFileInBase64,
				'utf8',
				'hex'
			);
			encryptedDataInBase64 += cipher.final('hex');

			next('', { ...args, encryptedDataInBase64, symmetricKeyEncrypted });
		});

		//-----------------------------------------------------------------------------------
		// CLEANUP EXTRANEOUS FILES

		taskList.push((args, next) => {
			const { zipOutputFilePath } = args;
			const localCallback = (err, fileReadResult) => {
				next(err, { ...args, fileReadResult });
			};

			fs.rm(
				path.dirname(zipOutputFilePath),
				{ recursive: true },
				localCallback
			);
		});

		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = { outputName, inFilePath, nodeRsaKey };

		pipeRunner(taskList.getList(), initialData, (err, args) => {
			const { inFilePath, encryptedDataInBase64, symmetricKeyEncrypted } = args;

			callback(err, { encryptedDataInBase64, symmetricKeyEncrypted });
		});
	};

	return { encryptData };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
