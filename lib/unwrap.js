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

const moduleFunction = function({ nodeRsaKey, secureContainerWorkingDir }) {
	//===================================================================================
	// UNWRAP DATA

	const decryptData = require('./decryptData')({ nodeRsaKey }).decryptData;

	//===================================================================================
	//===================================================================================
	// UNWRAP FILE

	const unwrapFile = ({ inFilePath, outputDirPath, outputName }, callback) => {
		console.log(
			`\n=-=============   unwrapFile  ========================= [unwrap.js.moduleFunction]\n`
		);

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
			const localCallback = (err, containerJson) => {
				next(err, { ...args, containerJson });
			};

			const fileData = fs.readFile(inFilePath, localCallback);
		});

		//-----------------------------------------------------------------------------------
		// EXTRACT SINGLE FILE ITEM (until restructure for proper list)

		taskList.push((args, next) => {
			const { containerJson } = args;
			const container = JSON.parse(containerJson);

			const symmetricKeyEncrypted = container.symmetricKeyEncrypted;
			const fileItem = container.fileList[0];
			const fileReadResult = fileItem[Object.keys(fileItem)[0]];
			next('', { ...args, fileReadResult, symmetricKeyEncrypted });
		});

		//-----------------------------------------------------------------------------------
		// DECRYPT BASE64 FILE ITEM

		taskList.push((args, next) => {
			const { nodeRsaKey, fileReadResult, symmetricKeyEncrypted } = args;

			const localCallback = (
				err,
				{ unzipOutputTempFilePath, unpackedFileDataList }
			) => {
				next(err, {
					...args,
					unzipOutputTempFilePath,
					unpackedFileDataList,
					outputName
				});
			};

			const outputName = args.outputName
				? args.outputName
				: `${path.basename(args.inFilePath)}.${path.extname(args.inFilePath)}`;

			decryptData(
				{
					nodeRsaKey,
					fileReadResult,
					symmetricKeyEncrypted,
					outputName,
					secureContainerWorkingDir
				},
				localCallback
			);
		});

		//-----------------------------------------------------------------------------------
		// ???????
		const getTargetFilePath = ({ outputDirPath, fileName }) => {
			const origPath = path.join(outputDirPath, fileName);
			let outPath = origPath;
			let counter = 0;

			while (fs.existsSync(outPath, fs.constants.R_OK)) {
				counter++;

				const parseStuff = path.parse(fileName);
				outPath = path.join(
					outputDirPath,
					`${parseStuff.name} copy ${counter}${parseStuff.ext}`
				);
			}
			return outPath;
		};

		taskList.push((args, next) => {
			const {
				unpackedFileDataList,
				outputDirPath,
				inFilePath,
				unzipOutputTempFilePath
			} = args;

			fs.mkdirSync(path.dirname(outputDirPath), {
				recursive: true
			});

			const outputFileList = unpackedFileDataList.map(fileItem => {
				const filePath = path.join(outputDirPath, fileItem.fileName);
				//		fs.cpSync(fileItem.contents, filePath, {recursive:true});
				return filePath;
			});

			const containerSegmentPath = unzipOutputTempFilePath;

			const fileList = fs.readdirSync(containerSegmentPath);

			const details = fileList
				.filter(fileName => !fileName.match(/^\./))
				.map(fileName => {
					const tmp = path.join(containerSegmentPath, fileName);

					const resultFilePath = getTargetFilePath({
						outputDirPath,
						fileName
					});

					fs.cpSync(tmp, resultFilePath, { recursive: true });

					return {
						fileName:resultFilePath
					};
				});

			fs.rmSync(path.dirname(unzipOutputTempFilePath), { recursive: true });

			next('', { ...args, resultFilePath: details });
		});

		//-----------------------------------------------------------------------------------
		// EXECUTE AND EXIT

		const initialData = { inFilePath, outputDirPath, outputName, nodeRsaKey };
		pipeRunner(taskList.getList(), initialData, (err, args) => {
			const { inFilePath, outputDirPath, resultFilePath } = args;

			callback(err, {
				inFilePath,
				resultFilePath,
				operation: moduleName
			});
		});
	};
	return { decryptData, unwrapFile };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
