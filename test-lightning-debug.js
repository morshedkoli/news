
const os = require('os');
const detectLibc = require('detect-libc');

console.log('Platform:', process.platform);
console.log('Arch:', process.arch);

const family = detectLibc.familySync();
console.log('Libc Family:', family);

let parts = [process.platform, process.arch];
if (process.platform === 'linux') {
    if (family === detectLibc.MUSL) {
        parts.push('musl');
    } else if (process.arch === 'arm') {
        parts.push('gnueabihf');
    } else {
        parts.push('gnu');
    }
}

const pkgName = `lightningcss-${parts.join('-')}`;
console.log('Computed Package Name:', pkgName);

try {
    console.log(`Attempting to require('${pkgName}')...`);
    const pkg = require(pkgName);
    console.log('Success! Package path:', require.resolve(pkgName));
    const pkgJson = require(`${pkgName}/package.json`);
    console.log('Package Version:', pkgJson.version);
} catch (err) {
    console.error('Failed to require package:', err);
}

const localPath = `../lightningcss.${parts.join('-')}.node`;
console.log('Fallback path (relative to lightningcss/node/index.js):', localPath);
