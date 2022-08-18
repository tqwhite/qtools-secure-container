qtools-secure-container
===============

An encrypted file format that is more transparent and useful than a zip file.


EG

const outputName=path.basename(inFilePath); //blah.jpg
unwrapFile(
	{ inFilePath, outputDirPath, outputName },
	localCallback
);