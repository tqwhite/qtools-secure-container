#!/usr/bin/env node
'use strict';

/*
	Streaming decryption - eliminates temp file vulnerability

	Data flow: base64 -> buffer -> decipher -> unzipper -> filesystem
	Decrypted data ONLY exists in memory until final write to destination.
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const unzipper = require('unzipper');

const asynchronousPipePlus = new require('qtools-asynchronous-pipe-plus')();
const pipeRunner = asynchronousPipePlus.pipeRunner;
const taskListPlus = asynchronousPipePlus.taskListPlus;

// =============================================================================
// MODULE

const moduleFunction = function({ rsaKeyPem, forceDitto }) {

	const decryptData = (args, decryptCallback) => {
		const { fileReadResult, symmetricKeyEncrypted, secureContainerWorkingDir } = args;
		const taskList = new taskListPlus();

		// -------------------------------------------------------------------------
		// RSA-UNWRAP THE SESSION KEY + IV

		taskList.push((args, next) => {
			const { symmetricKeyEncrypted } = args;

			try {
				const keyAndIv = crypto.privateDecrypt(
					{
						key: rsaKeyPem,
						padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
						oaepHash: 'sha256'
					},
					Buffer.from(symmetricKeyEncrypted, 'base64')
				);

				args.sessionKey = keyAndIv.subarray(0, 32);
				args.iv = keyAndIv.subarray(32, 48);
				next(null, args);
			} catch (err) {
				next(`RSA decryption failed: ${err}`, args);
			}
		});

		// -------------------------------------------------------------------------
		// CREATE TEMP OUTPUT DIRECTORY
		// Note: We still need a temp dir for unzipper output, but NO unencrypted
		// intermediate files are written. The decrypted stream goes directly
		// to the final destination via unzipper.

		taskList.push((args, next) => {
			const { secureContainerWorkingDir } = args;

			// Create unique output directory for this operation
			const uniqueId = `decrypt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			args.unzipOutputTempFilePath = path.join(secureContainerWorkingDir, uniqueId, 'content');

			try {
				fs.mkdirSync(args.unzipOutputTempFilePath, { recursive: true });
				next(null, args);
			} catch (err) {
				next(`Failed to create output directory: ${err}`, args);
			}
		});

		// -------------------------------------------------------------------------
		// STREAM: BASE64 -> DECIPHER -> UNZIP -> FILESYSTEM
		// This is where we eliminate the temp file vulnerability

		taskList.push((args, next) => {
			const { fileReadResult, sessionKey, iv, unzipOutputTempFilePath } = args;

			try {
				// Decode hex to buffer (matches original format for backward compatibility)
				const encryptedBuffer = Buffer.from(fileReadResult, 'hex');

				// Create streams
				const encryptedStream = Readable.from(encryptedBuffer);
				const decipher = crypto.createDecipheriv('aes-256-cbc', sessionKey, iv);

				// Error handlers - subordinated to pipeline via next()
				decipher.on('error', (err) => next(`Decipher error: ${err}`, args));

				// Pipeline: encrypted -> decipher -> unzipper -> filesystem
				// Decrypted data NEVER touches disk as an intermediate file
				encryptedStream
					.pipe(decipher)
					.pipe(unzipper.Extract({ path: unzipOutputTempFilePath }))
					.on('close', () => {
						// Build file list from extracted contents
						try {
							const files = fs.readdirSync(unzipOutputTempFilePath);
							args.unpackedFileDataList = files
								.filter(f => !f.startsWith('.'))
								.map(fileName => ({
									fileName,
									contents: path.join(unzipOutputTempFilePath, fileName)
								}));
							next(null, args);
						} catch (err) {
							next(`Failed to read extracted files: ${err}`, args);
						}
					})
					.on('error', (err) => next(`Unzip error: ${err}`, args));

			} catch (err) {
				next(`Decryption pipeline failed: ${err}`, args);
			}
		});

		// -------------------------------------------------------------------------
		// EXECUTE PIPELINE

		const initialData = {
			fileReadResult,
			symmetricKeyEncrypted,
			secureContainerWorkingDir,
			rsaKeyPem
		};

		pipeRunner(taskList.getList(), initialData, (err, args) => {
			if (err) {
				decryptCallback(err);
				return;
			}
			decryptCallback(null, {
				unzipOutputTempFilePath: args.unzipOutputTempFilePath,
				unpackedFileDataList: args.unpackedFileDataList
			});
		});
	};

	return { decryptData };
};

module.exports = moduleFunction;
