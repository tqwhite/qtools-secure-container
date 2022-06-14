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

//START OF moduleFunction() ============================================================

const moduleFunction = function({ nodeRsaKey }) {
	const wrap = (args, callback) => {
		const { inFilePath, outFilePath } = args;
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
		// ZIP FILE INPUT

		taskList.push((args, next) => {
			const { fileReadResult } = args;
			const { inFilePath, outFilePath } = args;

			const localCallback = (err, zipFilePath) => {
				next(err, { ...args, zipFilePath });
			};

			const zipFilePath = path.join(
				'/tmp',
				path.basename(inFilePath) + path.extname(inFilePath) + '.zip'
			);

			const shellCommand = `ditto -ck --rsrc  '${inFilePath}' '${zipFilePath}'`;
			exec(shellCommand, (error, stdout, stderr) => {
				if (error) {
					callback(error.message);
					return;
				}

				localCallback('', zipFilePath);
			});
		});

		//-----------------------------------------------------------------------------------
		// READ ZIP FILE

		taskList.push((args, next) => {
			const { zipFilePath } = args;
			const localCallback = (err, fileReadResult) => {
				next(err, { ...args, fileReadResult });
			};

			const fileData = fs.readFile(zipFilePath, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// UNPACK AND CONVERT

		taskList.push((args, next) => {
			const { fileReadResult } = args;
			const localCallback = (err, baseSixtyFour) => {
				next(err, { ...args, baseSixtyFour });
			};

			const baseSixtyFour = Buffer.from(fileReadResult.toString('base64'));

			localCallback('', baseSixtyFour);
		});

		taskList.push((args, next) => {
			const { nodeRsaKey, baseSixtyFour } = args;

			const localCallback = (err, wrappedFileData) => {
				next(err, { ...args, wrappedFileData });
			};

			if (true) {
				const encryptedData = nodeRsaKey.encrypt(baseSixtyFour); //or key.encryptPrivate()
				localCallback('', encryptedData);
			} else {
				localCallback('', baseSixtyFour);
			}
		});

		//-----------------------------------------------------------------------------------
		// WRITE FILE RESULTS

		taskList.push((args, next) => {
			const { wrappedFileData } = args;
			const { inFilePath, outFilePath } = args;

			const localCallback = err => {
				if (err) {
					next(err, args);
					return;
				}
				next(err, args);
			};

			fs.writeFile(outFilePath, wrappedFileData, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// CLEANUP EXTRANEOUS FILES

		taskList.push((args, next) => {
			const { zipFilePath } = args;
			const localCallback = (err, fileReadResult) => {
				next(err, { ...args, fileReadResult });
			};

			fs.unlink(zipFilePath, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = { inFilePath, outFilePath, nodeRsaKey };

		pipeRunner(taskList.getList(), initialData, (err, args) => {
			const { inFilePath, outFilePath } = args;
			callback(err, {
				inFilePath,
				outFilePath,
				operation: moduleName,
				isEncrypted: true
			});
		});
	};
	return { wrap };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
