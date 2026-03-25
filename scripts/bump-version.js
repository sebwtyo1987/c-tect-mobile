#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');
const configXmlPath = path.join(rootDir, 'config.xml');
const indexHtmlPath = path.join(rootDir, 'www', 'index.html');
const updateJsPath = path.join(rootDir, 'www', 'js', 'update.js');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filteredArgs = args.filter((arg) => arg !== '--dry-run');
const targetArg = filteredArgs[0];

function fail(message) {
  console.error('[bump-version]', message);
  process.exit(1);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function isValidSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function bumpVersion(version, level) {
  const parts = version.split('.').map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    fail('Versi saat ini tidak valid: ' + version);
  }

  if (level === 'major') {
    return [parts[0] + 1, 0, 0].join('.');
  }

  if (level === 'minor') {
    return [parts[0], parts[1] + 1, 0].join('.');
  }

  if (level === 'patch') {
    return [parts[0], parts[1], parts[2] + 1].join('.');
  }

  fail('Level bump tidak dikenal: ' + level);
}

function replaceOrFail(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    fail('Tidak menemukan bagian yang perlu diubah di ' + label);
  }

  return content.replace(pattern, replacement);
}

function printUsage(currentVersion) {
  console.log('Pemakaian:');
  console.log('  node scripts/bump-version.js 1.0.10');
  console.log('  node scripts/bump-version.js patch');
  console.log('  node scripts/bump-version.js minor');
  console.log('  node scripts/bump-version.js major');
  console.log('  node scripts/bump-version.js patch --dry-run');
  console.log('');
  console.log('Versi saat ini:', currentVersion);
}

const packageJson = JSON.parse(readText(packageJsonPath));
const currentVersion = packageJson.version;

if (!isValidSemver(currentVersion)) {
  fail('Versi di package.json tidak valid: ' + currentVersion);
}

if (!targetArg || targetArg === '--help' || targetArg === '-h' || targetArg === 'help') {
  printUsage(currentVersion);
  process.exit(0);
}

const nextVersion = ['patch', 'minor', 'major'].includes(targetArg)
  ? bumpVersion(currentVersion, targetArg)
  : targetArg;

if (!isValidSemver(nextVersion)) {
  fail('Versi tujuan harus format x.y.z, misalnya 1.0.10');
}

const packageLock = JSON.parse(readText(packageLockPath));
let configXml = readText(configXmlPath);
let indexHtml = readText(indexHtmlPath);
let updateJs = readText(updateJsPath);

packageJson.version = nextVersion;
packageLock.version = nextVersion;
if (packageLock.packages && packageLock.packages['']) {
  packageLock.packages[''].version = nextVersion;
}

configXml = replaceOrFail(
  configXml,
  /(<widget[^>]*\sversion=")([^"]+)(")/,
  '$1' + nextVersion + '$3',
  'config.xml'
);

indexHtml = replaceOrFail(
  indexHtml,
  /(ctech-mobile\s+)(\d+\.\d+\.\d+)/,
  '$1' + nextVersion,
  'www/index.html'
);

updateJs = replaceOrFail(
  updateJs,
  /(var\s+VERSI_APLIKASI\s*=\s*")([^"]+)(";)/,
  '$1' + nextVersion + '$3',
  'www/js/update.js'
);

console.log('[bump-version] Versi saat ini :', currentVersion);
console.log('[bump-version] Versi baru    :', nextVersion);
console.log('[bump-version] Mode          :', dryRun ? 'dry-run' : 'write');

if (!dryRun) {
  writeText(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  writeText(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
  writeText(configXmlPath, configXml);
  writeText(indexHtmlPath, indexHtml);
  writeText(updateJsPath, updateJs);
  console.log('[bump-version] File berhasil diperbarui.');
} else {
  console.log('[bump-version] Tidak ada file yang diubah.');
}
