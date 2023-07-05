#!/usr/bin/env node
'use strict';

const moduleName = __filename.replace(__dirname + '/', '').replace(/.js$/, ''); //this just seems to come in handy a lot
//const projectRoot=fs.realpathSync(path.join(__dirname, '..', '..')); // adjust the number of '..' to fit reality

const qt = require('qtools-functional-library'); //qt.help({printOutput:true, queryString:'.*', sendJson:false});

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

//START OF moduleFunction() ============================================================

const moduleFunction = function(args = {}) {
	// ===================================================================================
	// MACINTOSH FUNCTIONS

	// -----------------------------------------------------------------------------------
	// COMPRESS WITH DITTO

	const macExpand = ({ zipFilePath, unzipRawOutputDirPath }, callback) => {
		try {
			const os = require('os');

			const shellCommand = `ditto -xk --rsrc  '${zipFilePath}' '${unzipRawOutputDirPath}'`;
			execSync(shellCommand);

			callback('', unzipRawOutputDirPath);
		} catch (err) {
			callback(err.toString());
		}
	};

	// -----------------------------------------------------------------------------------
	// DECOMPRESS WITH DITTO

	const macShrink = ({ secureContainerPath, zipOutputFilePath }, callback) => {
		try {
			const os = require('os');

			const shellCommand = `ditto -ck --rsrc  '${secureContainerPath}' '${zipOutputFilePath}'`;

			execSync(shellCommand);
			callback('', zipOutputFilePath);
		} catch (err) {
			callback(err.toString());
		}
	};

	// ===================================================================================
	// LINUX FUNCTIONS

	// 	Secure Container was first written for Macintosh computers. They have the peculiarity
	// 	of a 'resource fork' as part of their file system. There is a compression utility
	// 	named ditto, used above, that accommodates this by splitting it off and archiving
	// 	a second file when needed.
	//
	// 	When this was ported to operate on Linux, Ditto did not exist and I had to add the
	// 	ability to use tar. Because tar is a terrible, old program, it gives very little
	// 	control over its use. Where ditto does the normal seeming 'decompress the archive
	// 	name X into a directory Y', tar forces the name of Y and a bunch of things about its
	// 	file structure. This forced me to jump through hoops to get the results into the
	// 	correct name and location to work with the rest of the program.
	//
	// 	For compression, this means fabricating a temp directory, putting the file with the
	// 	correct name into it, moving the working directory (cd) so that I could refer to the
	// 	target with the correct name and thereby causing tar to use the correct name.
	//
	// 	For expansion, I had to do the reverse. I created a temp directory, copied the archive
	// 	into it and extract. Since the program has no idea what the resulting file is named,
	// 	I had to list the archive (tar -tf) and parse the results. Given that, I renamed
	// 	that file to be the correct one (unzipRawOutputDirPath).
	//
	// 	Leftover files and stuff are cleaned up in the calling process.

	// -----------------------------------------------------------------------------------
	// COMPRESS WITH GZIP

	const zipExpand = ({ zipFilePath, unzipRawOutputDirPath }, callback) => {
		try {
			const { exec } = require('child_process');
			const os = require('os');
			if (!fs.existsSync) {
				fs.mkdirSync(unzipRawOutputDirPath, { recursive: true });
			}
			const zipFileParentPath = path.dirname(zipFilePath);
			const listArchiveCommand = `tar -tf ${zipFilePath}`;
			const listing = execSync(listArchiveCommand).toString();
			// prettier-ignore
			const containerName = listing .split('\n') .qtGetSurePath('[0]', '') .replace(/\//g, '');
			const containerPath = path.join(zipFileParentPath, containerName);

			const shellCommand = `cd "${zipFileParentPath}"; tar -xzf '${zipFilePath}'`; //compress, usePKZip, preserve resource fork
			execSync(shellCommand);

			fs.renameSync(containerPath, unzipRawOutputDirPath);

			callback('', unzipRawOutputDirPath);
		} catch (err) {
			callback(err.toString());
		}
	};

	// -----------------------------------------------------------------------------------
	// DECOMPRESS WITH GUNZIP

	const zipShrink = ({ secureContainerPath, zipOutputFilePath }, callback) => {
		try {
			const { exec } = require('child_process');
			const os = require('os');
			const tempDirectoryPath = path.dirname(secureContainerPath);
			const containerName = path.basename(secureContainerPath);
			const tarHolderName = `tarHolder_${containerName}`;
			const tarHolderDirPath = path.join(tempDirectoryPath, tarHolderName);
			const tarSecureContainerPath = path.join(tarHolderDirPath, containerName);

			fs.mkdirSync(tarHolderDirPath);
			fs.cpSync(secureContainerPath, tarSecureContainerPath, {
				recursive: true
			});

			const shellCommand = `cd ${tarHolderDirPath}; tar -czf  '${zipOutputFilePath}' '${containerName}'`; //extract, usePKZip, preserve resource fork
			execSync(shellCommand);

			callback('', zipOutputFilePath);
		} catch (err) {
			callback(err.toString());
		}
	};

	// ===================================================================================
	// EXPOSED METHODS

	//	this fails with uri:undefined on the client
	// 	const EXPAND_MAC=false; //expand tar
	// 	const SHRINK_MAC=true; //compress ditto

	// 	This fails with: ditto: Couldn't read PKZip signature
	// 	const EXPAND_MAC=true; //expand ditto
	// 	const SHRINK_MAC=false; //compress tar

	const EXPAND_MAC = false; //use tar
	const SHRINK_MAC = false; //use tar
	const OS_SENSING_allowed = false; //forceDitto comes in from macOS?true:false, this forces override with flags above

	const expand = (
		{ zipFilePath, unzipRawOutputDirPath, forceDitto },
		callback
	) => {
		forceDitto = OS_SENSING_allowed ? forceDitto : true; //true means use flags above always

		if (EXPAND_MAC && forceDitto) {
			macExpand({ zipFilePath, unzipRawOutputDirPath }, callback);
		} else {
			zipExpand({ zipFilePath, unzipRawOutputDirPath }, callback);
		}
	};
	const shrink = (
		{ secureContainerPath, zipOutputFilePath, forceDitto },
		callback
	) => {
		forceDitto = OS_SENSING_allowed ? forceDitto : true; //true means use flags above always

		if (SHRINK_MAC && forceDitto) {
			macShrink({ secureContainerPath, zipOutputFilePath }, callback);
		} else {
			zipShrink({ secureContainerPath, zipOutputFilePath }, callback);
		}
	};

	return { expand, shrink };
};

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
//module.exports = new moduleFunction();
//moduleFunction().workingFunction().qtDump();

