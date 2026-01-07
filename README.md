qtools-secure-container
===============

An encrypted file format that is more transparent and useful than a zip file.

## Security

Uses hybrid encryption:
- **AES-256-CBC** for symmetric data encryption
- **RSA-OAEP with SHA-256** for key wrapping

As of v0.0.29, encryption/decryption uses in-memory streaming. No unencrypted intermediate files are written to disk, eliminating the temp file exposure vulnerability present in earlier versions.

## Installation

```bash
npm install qtools-secure-container
```

## Usage

```javascript
const secureContainerGen = require('qtools-secure-container');

// Initialize with a PEM key (private key for both encrypt/decrypt, or public for encrypt-only)
secureContainerGen({ rsaKeyPem: yourKeyPem }, (err, { wrapFile, unwrapFile }) => {

    // Encrypt a file
    wrapFile({ inFilePath: '/path/to/file.pdf', outFilePath: '/path/to/file.container' }, (err, result) => {
        console.log('Encrypted:', result.outFilePath);
    });

    // Decrypt a file
    unwrapFile({ inFilePath: '/path/to/file.container', outputDirPath: '/path/to/output/' }, (err, result) => {
        console.log('Decrypted:', result.resultFilePath);
    });
});
```

## Testing

```bash
npm test                           # Roundtrip test on package.json
npm run test:roundtrip <file>      # Test specific file
npm run test:wrap <in> <out>       # Encrypt only
npm run test:unwrap <in> <dir>     # Decrypt only
```

## Changelog

### v0.0.29
- **Security improvement**: Switched to streaming encryption/decryption
- No unencrypted temp files written to disk during processing
- ~4x faster than previous temp-file-based approach
- Backward compatible with containers created by earlier versions

### v0.0.28
- Migrated from node-rsa to native Node.js crypto module
- Uses RSA-OAEP with SHA-256 padding

## License

ISC
