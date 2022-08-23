#!/usr/bin/env node
'use strict';

const qt = require('qtools-functional-library');
const moduleName = __filename.replace(__dirname + '/', '').replace(/.js$/, ''); //this just seems to come in handy a lot

const asynchronousPipePlus = new require('qtools-asynchronous-pipe-plus')();
const pipeRunner = asynchronousPipePlus.pipeRunner;
const taskListPlus = asynchronousPipePlus.taskListPlus;

const fs = require('fs');
const path = require('path');

//START OF moduleFunction() ============================================================

const moduleFunction = function({ nodeRsaKey, secureContainerWorkingDir }) {
	// ===================================================================================
	//WRAP DATA TO DATA

	const encryptData = require('./encryptData')({ nodeRsaKey }).encryptData;

	// ===================================================================================
	//WRAP FILE

	const wrapFile = ({ inFilePath, outFilePath }, callback) => {
		 const taskList = new taskListPlus();

		//-----------------------------------------------------------------------------------
		// VALIDATE INPUTS

		taskList.push((args, next) => {
			const { inFilePath, outFilePath, nodeRsaKey } = args;
			const localCallback = err => {
				if (err) {
					next(
						`input file, ${inFilePath}, does not exist or is not readable`,
						args
					);
					return;
				}
				next(err, args);
			};

			fs.access(inFilePath, fs.constants.R_OK, localCallback);
		});

		taskList.push((args, next) => {
			const { inFilePath, outFilePath } = args;
			const localCallback = err => {
				if (err) {
					next(
						`output directory, ${outFilePath}, does not exist or is not writable`,
						args
					);
					return;
				}
				next(err, args);
			};
			fs.access(path.dirname(outFilePath), fs.constants.W_OK, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// ENCRYPT DATA

		taskList.push((args, next) => {
			const { inFilePath } = args;
			const localCallback = (
				err,
				{ encryptedDataInBase64, symmetricKeyEncrypted }
			) => {
				next(err, { ...args, encryptedDataInBase64, symmetricKeyEncrypted });
			};

			const outputName = path.basename(inFilePath);
			encryptData({ ...args, outputName }, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// STRUCTURE JSON OUTPUT DATA

		taskList.push((args, next) => {
			const { encryptedDataInBase64, symmetricKeyEncrypted } = args;

			const { inFilePath, outFilePath } = args;

			const localCallback = err => {
				if (err) {
					next(err, args);
					return;
				}
				next(err, args);
			};

			const fileName = path.basename(inFilePath);

			const tmp = {
				symmetricKeyEncrypted,
				fileList: [{ [fileName]: encryptedDataInBase64 }]
			};

			const container = JSON.stringify(tmp);

			next('', { ...args, container });
		});

		//-----------------------------------------------------------------------------------
		// WRITE ENCRYPTED BUFFER TO OUTFILE

		taskList.push((args, next) => {
			const {
				encryptedDataInBase64,
				inFilePath,
				outFilePath,
				container
			} = args;

			const localCallback = err => {

				if (err) {
					next(err, args);
					return;
				}
				next(err, args);
			};

			 fs.writeFile(outFilePath, container, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = {
			inFilePath,
			outFilePath,
			nodeRsaKey,
			secureContainerWorkingDir
		};

		pipeRunner(taskList.getList(), initialData, (err, args) => {
			const { inFilePath, outFilePath } = args;
			callback(err, {
				inFilePath,
				outFilePath,
				operation: moduleName
			});
		});
	};
	return { wrapFile, encryptData };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
