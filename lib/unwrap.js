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
	//===================================================================================
	// UNWRAP DATA

	const unwrapData = ({ nodeRsaKey, fileReadResult, outputName }, callback) => {
		const taskList = new taskListPlus();

		//-----------------------------------------------------------------------------------
		// UNPACK AND CONVERT

		taskList.push((args, next) => {
			const { nodeRsaKey, fileReadResult } = args;
			const { secure } = { secure: true };

			const localCallback = (err, decryptedData) => {
				next(err, { ...args, decryptedData });
			};
			
			const unBase46Version = Buffer.from(
				fileReadResult.toString('utf8'),
				'base64'
			);

			if (secure) {
				const decryptedData = nodeRsaKey
					.decrypt(unBase46Version)
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
			const zipFilePath = path.join('/tmp', path.basename(outputName) + '.zip');

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
			const dittoOutputFilePath = path.join(
				'/tmp',
				`${Math.random()
					.toString()
					.replace(/^0*\./, '')}.ditto`,
				`${path.basename(outputName)}`
			);

			const localCallback = err => {
				next(err, { ...args, dittoOutputFilePath });
			};

			const shellCommand = `ditto -xk --rsrc  '${zipFilePath}' '${dittoOutputFilePath}'`;

			exec(shellCommand, (error, stdout, stderr) => {
				if (error) {
					callback(error.message);
					return;
				}

				localCallback('');
			});
		});

		//-----------------------------------------------------------------------------------
		// UPZIP FILE

		taskList.push((args, next) => {
			const { dittoOutputFilePath } = args;
			const fileList = fs.readdirSync(dittoOutputFilePath);

			const unpackedFileDataList = fileList.map(fileName => ({
				fileName,
				contents: fs.readFileSync(path.join(dittoOutputFilePath, fileName))
			}));

			next('', { ...args, unpackedFileDataList });
		});

		//-----------------------------------------------------------------------------------
		// UPZIP FILE

		taskList.push((args, next) => {
			const { zipFilePath } = args;
			const localCallback = err => {
				next(err, { ...args });
			};

			fs.unlink(zipFilePath, localCallback);
		});
		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = { nodeRsaKey, fileReadResult, outputName };
		pipeRunner(taskList.getList(), initialData, (err, args) => {
			const { unpackedFileDataList } = args;
			callback(err, {
				unpackedFileDataList,
				operation: moduleName,
				isEncrypted: true
			});
		});
	};
	
	//===================================================================================
	//===================================================================================
	// UNWRAP FILE
	
	const unwrapFile = ({ inFilePath, outputDirPath, outputName }, callback) => {
		const taskList = new taskListPlus();

		//-----------------------------------------------------------------------------------
		// VALIDATE INPUTS

		taskList.push((args, next) => {
			const { inFilePath } = args;
			const localCallback = err => {
				if (err) {
					next(
						`input file, ${inFilePath}, does not exist or is not readable [${moduleName}]`,
						args
					);
					return;
				}
				next(err, args);
			};

			fs.access(inFilePath, fs.constants.R_OK, localCallback);
		});

		taskList.push((args, next) => {
			const { outputDirPath } = args;
			const localCallback = err => {
				if (err) {
					next(
						`output directory, ${outputDirPath}, does not exist or is not writable [${moduleName}]`,
						args
					);
					return;
				}
				next(err, args);
			};
			console.log(
				`ADD: fs.stats() and isDir() to check outputDirPath [${moduleName}]`
			);
			fs.access(outputDirPath, fs.constants.W_OK, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// READ FILE INPUT

		taskList.push((args, next) => {
			const { inFilePath } = args;
			const localCallback = (err, fileReadResult) => {
				next(err, { ...args, fileReadResult });
			};

			const fileData = fs.readFile(inFilePath, localCallback);
		});

		taskList.push((args, next) => {
			const outputName = args.outputName
				? args.outputName
				: `${path.basename(args.inFilePath)}.${path.extname(args.inFilePath)}`;
			const localCallback = (err, unwrapResult) => {
				next(err, { ...args, ...unwrapResult, outputName });
			};

			unwrapData({ ...args, outputName }, localCallback);
		});
		taskList.push((args, next) => {
			const { unpackedFileDataList, outputDirPath, inFilePath } = args;

			fs.mkdirSync(path.dirname(outputDirPath), {
				recursive: true
			});

			const outFileList = unpackedFileDataList.map(fileItem => {
				const filePath = path.join(outputDirPath, fileItem.fileName);
				fs.writeFileSync(filePath, fileItem.contents);
			});

			next('', args);
		});

		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = { inFilePath, outputDirPath, outputName, nodeRsaKey };
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
	return { unwrapData, unwrapFile };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
