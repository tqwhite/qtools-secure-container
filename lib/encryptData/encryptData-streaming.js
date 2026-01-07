#!/usr/bin/env node
'use strict';

/*
	Streaming encryption - eliminates temp file vulnerability

	Data flow: file -> archiver (in memory) -> cipher -> base64 output
	No unencrypted data ever touches disk.
*/

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const asynchronousPipePlus = new require('qtools-asynchronous-pipe-plus')();
const pipeRunner = asynchronousPipePlus.pipeRunner;
const taskListPlus = asynchronousPipePlus.taskListPlus;

// =============================================================================
// MODULE

const moduleFunction = function({ rsaKeyPem, forceDitto }) {

	const encryptData = (args, encryptCallback) => {
		const { inFilePath, outputName } = args;
		const taskList = new taskListPlus();

		// -------------------------------------------------------------------------
		// GENERATE SESSION KEY AND IV

		taskList.push((args, next) => {
			args.sessionKey = crypto.randomBytes(32);  // AES-256
			args.iv = crypto.randomBytes(16);
			next(null, args);
		});

		// -------------------------------------------------------------------------
		// STREAM: FILE -> ZIP -> ENCRYPT -> BUFFER
		// This is where we eliminate the temp file vulnerability

		taskList.push((args, next) => {
			const { inFilePath, sessionKey, iv } = args;

			const archive = archiver('zip', { zlib: { level: 9 } });
			const cipher = crypto.createCipheriv('aes-256-cbc', sessionKey, iv);
			const encryptedChunks = [];

			// Error handlers - subordinated to pipeline via next()
			archive.on('error', (err) => next(`Archive error: ${err}`, args));
			cipher.on('error', (err) => next(`Cipher error: ${err}`, args));

			// Collect encrypted output
			cipher.on('data', (chunk) => encryptedChunks.push(chunk));

			// Pipeline completion - triggers next() in the taskList
			cipher.on('end', () => {
				args.encryptedBuffer = Buffer.concat(encryptedChunks);
				next(null, args);
			});

			// Connect: archive -> cipher
			archive.pipe(cipher);

			// Add source file/directory to archive (streams from disk, never copies unencrypted)
			const entryName = path.basename(inFilePath);

			try {
				const stat = fs.statSync(inFilePath);

				if (stat.isDirectory()) {
					archive.directory(inFilePath, entryName);
				} else {
					archive.file(inFilePath, { name: entryName });
				}

				// Finalize triggers the pipeline
				archive.finalize();
			} catch (err) {
				next(`Failed to read source: ${err}`, args);
			}
		});

		// -------------------------------------------------------------------------
		// RSA-WRAP THE SESSION KEY + IV

		taskList.push((args, next) => {
			const { sessionKey, iv } = args;

			try {
				const keyAndIv = Buffer.concat([sessionKey, iv]);

				args.symmetricKeyEncrypted = crypto.publicEncrypt(
					{
						key: rsaKeyPem,
						padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
						oaepHash: 'sha256'
					},
					keyAndIv
				).toString('base64');

				next(null, args);
			} catch (err) {
				next(`RSA encryption failed: ${err}`, args);
			}
		});

		// -------------------------------------------------------------------------
		// FORMAT OUTPUT

		taskList.push((args, next) => {
			const { encryptedBuffer, symmetricKeyEncrypted } = args;

			// Use hex encoding to match original format (backward compatible)
			args.result = {
				encryptedDataInBase64: encryptedBuffer.toString('hex'),
				symmetricKeyEncrypted
			};

			next(null, args);
		});

		// -------------------------------------------------------------------------
		// EXECUTE PIPELINE

		const initialData = { inFilePath, outputName, rsaKeyPem };

		pipeRunner(taskList.getList(), initialData, (err, args) => {
			if (err) {
				encryptCallback(err);
				return;
			}
			encryptCallback(null, args.result);
		});
	};

	return { encryptData };
};

module.exports = moduleFunction;
