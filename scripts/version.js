#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const versionType = process.argv[2] || 'patch';
const allowedTypes = ['major', 'minor', 'patch'];

if (!allowedTypes.includes(versionType)) {
  console.error(`Error: Version type must be one of: ${allowedTypes.join(', ')}`);
  process.exit(1);
}

async function updateVersion() {
  // Read package.json
  const packageJson = JSON.parse(await readFile('./package.json', 'utf-8'));
  const [major, minor, patch] = packageJson.version.split('.').map(Number);

  // Calculate new version
  let newVersion;
  if (versionType === 'major') {
    newVersion = `${major + 1}.0.0`;
  } else if (versionType === 'minor') {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  console.log(`Bumping version: ${packageJson.version} → ${newVersion}`);

  // Update package.json
  packageJson.version = newVersion;
  await writeFile('./package.json', JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✓ Updated package.json');

  // Update package-lock.json
  const packageLockJson = JSON.parse(await readFile('./package-lock.json', 'utf-8'));
  packageLockJson.version = newVersion;
  if (packageLockJson.packages?.['']) {
    packageLockJson.packages[''].version = newVersion;
  }
  await writeFile('./package-lock.json', JSON.stringify(packageLockJson, null, 2) + '\n');
  console.log('✓ Updated package-lock.json');

  // Update .claude-plugin/plugin.json
  const pluginJson = JSON.parse(await readFile('./.claude-plugin/plugin.json', 'utf-8'));
  pluginJson.version = newVersion;
  await writeFile('./.claude-plugin/plugin.json', JSON.stringify(pluginJson, null, 2) + '\n');
  console.log('✓ Updated .claude-plugin/plugin.json');

  // Update .claude-plugin/marketplace.json
  const marketplaceJson = JSON.parse(await readFile('./.claude-plugin/marketplace.json', 'utf-8'));
  if (marketplaceJson.plugins?.[0]) {
    marketplaceJson.plugins[0].version = newVersion;
  }
  await writeFile('./.claude-plugin/marketplace.json', JSON.stringify(marketplaceJson, null, 2) + '\n');
  console.log('✓ Updated .claude-plugin/marketplace.json');

  // Update README.md version badge
  const readme = await readFile('./README.md', 'utf-8');
  const updatedReadme = readme.replace(
    /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[\d.]+(-[\w.]+)?-blue\)/,
    `![Version](https://img.shields.io/badge/version-${newVersion}-blue)`
  );
  await writeFile('./README.md', updatedReadme);
  console.log('✓ Updated README.md version badge');

  // Stage files
  execSync('git add package.json package-lock.json .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md', { stdio: 'inherit' });
  console.log('✓ Staged version files');

  console.log(`\nVersion bumped to ${newVersion}`);
  console.log('Files staged and ready to commit.');
}

updateVersion().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
