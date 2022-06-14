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
	const unwrap = ({ inFilePath, outFilePath }, callback) => {
		const taskList = new taskListPlus();

		//-----------------------------------------------------------------------------------
		// VALIDATE INPUTS

		taskList.push((args, next) => {
			const { inFilePath, outFilePath } = args;
			const localCallback = err => {
				if (err) {
					next(`input file, ${inFilePath}, does not exist or is not readable`);
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
						`output directory, ${outFilePath}, does not exist or is not writable`
					);
					return;
				}
				next(err, args);
			};

			fs.access(path.dirname(outFilePath), fs.constants.W_OK, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// READ FILE INPUT

		taskList.push((args, next) => {
			const { inFilePath, outFilePath } = args;
			const localCallback = (err, fileReadResult) => {
				next(err, { ...args, fileReadResult });
			};

			const fileData = fs.readFile(inFilePath, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// UNPACK AND CONVERT

		taskList.push((args, next) => {
			const { nodeRsaKey, fileReadResult } = args;
			const { secure } = {secure:true}

			const localCallback = (err, decryptedData) => {
				next(err, { ...args, decryptedData });
			};

			if (secure) {
				const decryptedData = nodeRsaKey
					.decrypt(fileReadResult)
					.toString('utf8'); //or key.decryptPublic()
				localCallback('', decryptedData);
			} else {
				localCallback('', unBase64);
			}
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
		// WRITE FILE RESULTS

		taskList.push((args, next) => {
			const { unBase64 } = args;
			const { inFilePath, outFilePath } = args;

			const localCallback = (err, zipFilePath) => {
				if (err) {
					next(err);
					return;
				}
				next(err, { ...args, zipFilePath });
			};
			const zipFilePath = path.join('/tmp', path.basename(inFilePath) + '.zip');

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
			const { inFilePath, outFilePath } = args;

			const localCallback = (err, outFilePath) => {
				next(err, { ...args, outFilePath });
			};

			const shellCommand = `ditto -xk --rsrc  '${zipFilePath}' '${outFilePath}'`;
			exec(shellCommand, (error, stdout, stderr) => {
				if (error) {
					callback(error.message);
					return;
				}

				localCallback('', outFilePath);
			});
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
	return { unwrap };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
