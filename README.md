qtools-secure-container
===============

An encrypted file format that is more transparent and useful than a zip file.

DO NOT USE THIS YET.

At least, only use it for temporary containers. This is still under active
development and I have every intention of changing the file format several
more times before I get it to a point that I can commit to longevity. tqii


EG

const outputName=path.basename(inFilePath); //blah.jpg
unwrapFile(
	{ inFilePath, outputDirPath, outputName },
	localCallback
);