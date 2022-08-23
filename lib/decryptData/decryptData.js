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
	//===================================================================================
	// UNWRAP DATA

	const decryptData = (
		{
			nodeRsaKey,
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
			const { nodeRsaKey, fileReadResult, symmetricKeyEncrypted } = args;
			const { secure } = { secure: true };

			const localCallback = (err, decryptedData) => {
				next(err, { ...args, decryptedData });
			};

			const unBase64StillEncrypted = Buffer.from(
				fileReadResult.toString('utf8'),
				'base64'
			);

			const tmp = Buffer.from(symmetricKeyEncrypted.toString('utf8'), 'base64');

			const symmetricKeyDecrypted = nodeRsaKey.decrypt(tmp).toString('utf8'); //or key.decryptPublic()

			const decipher = crypto.createDecipher('aes192', symmetricKeyDecrypted);

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

			const shellCommand = `ditto -xk --rsrc  '${zipFilePath}' '${unzipRawOutputDirPath}'`;
			exec(shellCommand, (error, stdout, stderr) => {
				if (error) {
					callback(error.message);
					return;
				}

				localCallback('');
			});
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
			nodeRsaKey,
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
