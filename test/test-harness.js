#!/usr/bin/env node
'use strict';

/*
	Test Harness for qtools-secure-container

	Usage:
		node test-harness.js wrap <inputFile> <outputFile> [--key=keyfile.pem]
		node test-harness.js unwrap <inputFile> <outputDir> [--key=keyfile.pem]
		node test-harness.js roundtrip <inputFile> [--keep]

	Examples:
		node test-harness.js wrap ./testfile.txt ./testfile.container
		node test-harness.js unwrap ./testfile.container ./output/
		node test-harness.js roundtrip ./testfile.txt

	Options:
		--key=<path>    Use specified PEM key file (generates new if omitted)
		--keep          Keep intermediate files after roundtrip test
		--verbose       Show detailed output
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const secureContainer = require('../qtools-secure-container');

// =============================================================================
// ARGUMENT PARSING

const args = process.argv.slice(2);
const operation = args[0];
const inputPath = args[1];
const outputPath = args[2];

const flags = {
	key: args.find(a => a.startsWith('--key='))?.split('=')[1],
	keep: args.includes('--keep'),
	verbose: args.includes('--verbose')
};

const log = (msg) => console.log(`[test-harness] ${msg}`);
const verbose = (msg) => flags.verbose && console.log(`  ${msg}`);

// =============================================================================
// KEY MANAGEMENT

const getOrCreateKey = (callback) => {
	if (flags.key) {
		verbose(`Loading key from ${flags.key}`);
		const keyPem = fs.readFileSync(flags.key, 'utf8');
		callback(null, keyPem);
	} else {
		verbose('Generating new RSA key pair...');
		const { privateKey } = crypto.generateKeyPairSync('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: { type: 'spki', format: 'pem' },
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
		});
		callback(null, privateKey);
	}
};

// =============================================================================
// OPERATIONS

const doWrap = (inputPath, outputPath, callback) => {
	if (!inputPath || !outputPath) {
		callback('Usage: test-harness.js wrap <inputFile> <outputFile>');
		return;
	}

	getOrCreateKey((err, keyPem) => {
		if (err) return callback(err);

		secureContainer({ rsaKeyPem: keyPem }, (err, { wrapFile }) => {
			if (err) return callback(err);

			log(`Wrapping: ${inputPath} -> ${outputPath}`);
			const startTime = Date.now();

			wrapFile({ inFilePath: inputPath, outFilePath: outputPath }, (err, result) => {
				const elapsed = Date.now() - startTime;

				if (err) {
					callback(`Wrap failed: ${err}`);
					return;
				}

				const stats = fs.statSync(outputPath);
				log(`Success: ${stats.size} bytes written in ${elapsed}ms`);
				verbose(`Output: ${result.outFilePath}`);
				callback(null, result);
			});
		});
	});
};

const doUnwrap = (inputPath, outputDir, callback) => {
	if (!inputPath || !outputDir) {
		callback('Usage: test-harness.js unwrap <inputFile> <outputDir>');
		return;
	}

	// Ensure output directory exists
	fs.mkdirSync(outputDir, { recursive: true });

	getOrCreateKey((err, keyPem) => {
		if (err) return callback(err);

		secureContainer({ rsaKeyPem: keyPem }, (err, { unwrapFile }) => {
			if (err) return callback(err);

			log(`Unwrapping: ${inputPath} -> ${outputDir}`);
			const startTime = Date.now();

			unwrapFile({ inFilePath: inputPath, outputDirPath: outputDir }, (err, result) => {
				const elapsed = Date.now() - startTime;

				if (err) {
					callback(`Unwrap failed: ${err}`);
					return;
				}

				log(`Success: extracted in ${elapsed}ms`);
				verbose(`Result files: ${JSON.stringify(result.resultFilePath)}`);
				callback(null, result);
			});
		});
	});
};

const doRoundtrip = (inputPath, callback) => {
	if (!inputPath) {
		callback('Usage: test-harness.js roundtrip <inputFile>');
		return;
	}

	const tempDir = path.join('/tmp', `secure-container-test-${Date.now()}`);
	const containerPath = path.join(tempDir, 'test.container');
	const outputDir = path.join(tempDir, 'output');

	fs.mkdirSync(tempDir, { recursive: true });
	fs.mkdirSync(outputDir, { recursive: true });

	log(`Roundtrip test for: ${inputPath}`);
	log(`Temp directory: ${tempDir}`);

	// Generate a key to use for both operations
	getOrCreateKey((err, keyPem) => {
		if (err) return callback(err);

		// Save key for debugging if --keep
		if (flags.keep) {
			const keyPath = path.join(tempDir, 'test-key.pem');
			fs.writeFileSync(keyPath, keyPem);
			verbose(`Key saved: ${keyPath}`);
		}

		secureContainer({ rsaKeyPem: keyPem }, (err, { wrapFile, unwrapFile }) => {
			if (err) return callback(err);

			// WRAP
			log('Step 1: Wrapping...');
			const wrapStart = Date.now();

			wrapFile({ inFilePath: inputPath, outFilePath: containerPath }, (err, wrapResult) => {
				if (err) return callback(`Wrap failed: ${err}`);

				const wrapElapsed = Date.now() - wrapStart;
				const containerStats = fs.statSync(containerPath);
				log(`  Wrapped in ${wrapElapsed}ms (${containerStats.size} bytes)`);

				// UNWRAP
				log('Step 2: Unwrapping...');
				const unwrapStart = Date.now();

				unwrapFile({ inFilePath: containerPath, outputDirPath: outputDir }, (err, unwrapResult) => {
					if (err) return callback(`Unwrap failed: ${err}`);

					const unwrapElapsed = Date.now() - unwrapStart;
					log(`  Unwrapped in ${unwrapElapsed}ms`);

					// VERIFY
					log('Step 3: Verifying...');

					const originalName = path.basename(inputPath);
					const recoveredPath = path.join(outputDir, originalName);

					if (!fs.existsSync(recoveredPath)) {
						// Check what files exist
						const files = fs.readdirSync(outputDir);
						callback(`Verification failed: expected ${originalName}, found: ${files.join(', ')}`);
						return;
					}

					const originalStats = fs.statSync(inputPath);
					const recoveredStats = fs.statSync(recoveredPath);

					if (originalStats.isDirectory()) {
						log(`  Directory roundtrip completed (manual verification needed)`);
					} else {
						const originalContent = fs.readFileSync(inputPath);
						const recoveredContent = fs.readFileSync(recoveredPath);

						if (Buffer.compare(originalContent, recoveredContent) === 0) {
							log(`  PASS: Content matches (${originalContent.length} bytes)`);
						} else {
							callback(`FAIL: Content mismatch! Original: ${originalContent.length} bytes, Recovered: ${recoveredContent.length} bytes`);
							return;
						}
					}

					// Cleanup unless --keep
					if (!flags.keep) {
						fs.rmSync(tempDir, { recursive: true });
						verbose('Temp files cleaned up');
					} else {
						log(`Temp files kept at: ${tempDir}`);
					}

					log(`Total time: ${wrapElapsed + unwrapElapsed}ms`);
					callback(null, { wrapResult, unwrapResult });
				});
			});
		});
	});
};

// =============================================================================
// MAIN

const showUsage = () => {
	console.log(`
Usage:
  test-harness.js wrap <inputFile> <outputFile> [--key=keyfile.pem]
  test-harness.js unwrap <inputFile> <outputDir> [--key=keyfile.pem]
  test-harness.js roundtrip <inputFile> [--keep] [--verbose]

Operations:
  wrap       Encrypt a file into a secure container
  unwrap     Decrypt a secure container to a directory
  roundtrip  Wrap then unwrap, verify content matches

Options:
  --key=<path>  Use specified PEM key file (generates new if omitted)
  --keep        Keep intermediate files after roundtrip test
  --verbose     Show detailed output
`);
};

if (!operation) {
	showUsage();
	process.exit(1);
}

const done = (err, result) => {
	if (err) {
		console.error(`\nERROR: ${err}`);
		process.exit(1);
	}
	process.exit(0);
};

switch (operation) {
	case 'wrap':
		doWrap(inputPath, outputPath, done);
		break;
	case 'unwrap':
		doUnwrap(inputPath, outputPath, done);
		break;
	case 'roundtrip':
		doRoundtrip(inputPath, done);
		break;
	default:
		console.error(`Unknown operation: ${operation}`);
		showUsage();
		process.exit(1);
}
