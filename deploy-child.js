#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const TEN_PROJECT = process.argv[2];
const SOURCE_FOLDER = process.argv[3];
const SERVICE_ACCOUNT_PATH = process.argv[4];

const SERVICE_ACCOUNT = path.join(SCRIPT_DIR, 'firebase', SERVICE_ACCOUNT_PATH);
const SOURCE_DIR = path.join(SCRIPT_DIR, 'downloads', SOURCE_FOLDER || '');
const TEMPLATE_DIR = path.join(SCRIPT_DIR, 'finished', 'proj-temp');
const TARGET_DIR = path.join(SCRIPT_DIR, 'finished', `${TEN_PROJECT || ''}`);
const TARGET_PUBLIC = path.join(TARGET_DIR, 'public');

function fail(message) {
    console.error(`\n${message}\n`);
    process.exit(1);
}

function logStep(step, message) {
    console.log(`${step} ${message}`);
}

console.log('\n============================================================');
console.log('Firebase Child Project Deployment (Node.js)');
console.log('============================================================');

if (!TEN_PROJECT) {
    fail('ERROR: Missing ten_project parameter.\nUsage: node deploy-child.js <ten_project> <folder>');
}

if (!SOURCE_FOLDER) {
    fail('ERROR: Missing folder parameter.\nUsage: node deploy-child.js <ten_project> <folder>');
}

if (/\s/.test(TEN_PROJECT)) {
    fail('ERROR: ten_project must not contain spaces.');
}

logStep('[1/10]', 'Checking Firebase Service Account...');
if (!fs.existsSync(SERVICE_ACCOUNT)) {
    fail(`ERROR: Service Account not found: ${SERVICE_ACCOUNT}`);
}
console.log('✓ Service account found\n');

logStep('[2/10]', 'Checking source folder...');
if (!fs.existsSync(SOURCE_DIR)) {
    fail(`ERROR: Source folder not found: ${SOURCE_DIR}`);
}
console.log(`✓ Source folder found: ${SOURCE_DIR}\n`);

logStep('[3/10]', 'Checking project template...');
if (!fs.existsSync(TEMPLATE_DIR)) {
    fail(`ERROR: Project template not found: ${TEMPLATE_DIR}`);
}
console.log('✓ Template found\n');

logStep('[4/10]', 'Checking target project directory...');
if (fs.existsSync(TARGET_DIR)) {
    console.log(`WARN: Target project already exists: ${TARGET_DIR}`);
    //remove the target directory if it exists
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
}
console.log('✓ Target directory available\n');

logStep('[5/10]', 'Copying project template...');
try {
    fs.cpSync(TEMPLATE_DIR, TARGET_DIR, { recursive: true });
    console.log(`✓ Copied template to: ${TARGET_DIR}\n`);
} catch (error) {
    fail(`ERROR: Failed to copy template: ${error.message}`);
}

logStep('[6/10]', 'Copying downloaded content into public folder...');
try {
    fs.rmSync(TARGET_PUBLIC, { recursive: true, force: true });
    fs.mkdirSync(TARGET_PUBLIC, { recursive: true });

    const folderName = path.basename(SOURCE_DIR);
    const sourceRootInPublic = path.join(TARGET_PUBLIC, folderName);
    fs.cpSync(SOURCE_DIR, sourceRootInPublic, { recursive: true });

    console.log(`✓ Copied source folder into: ${sourceRootInPublic}\n`);
} catch (error) {
    fail(`ERROR: Failed to copy downloaded content: ${error.message}`);
}

logStep('[7/10]', 'Updating package.json...');
try {
    const packageJsonPath = path.join(TARGET_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.name = TEN_PROJECT;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    console.log(`✓ package.json name set to: ${TEN_PROJECT}\n`);
} catch (error) {
    fail(`ERROR: Failed to update package.json: ${error.message}`);
}

logStep('[8/10]', 'Updating .firebaserc...');
try {
    const firebaseRcPath = path.join(TARGET_DIR, '.firebaserc');
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    firebaseRc.projects = firebaseRc.projects || {};
    firebaseRc.projects.default = TEN_PROJECT;
    fs.writeFileSync(firebaseRcPath, `${JSON.stringify(firebaseRc, null, 2)}\n`, 'utf8');
    console.log(`✓ .firebaserc default project set to: ${TEN_PROJECT}\n`);
} catch (error) {
    fail(`ERROR: Failed to update .firebaserc: ${error.message}`);
}

logStep('[9/10]', 'Verifying Firebase project and deploying...');
try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    console.log(`Node version: ${nodeVersion}`);

    const firebaseVersion = execSync('firebase --version', { encoding: 'utf-8' }).trim();
    console.log(`Firebase version: ${firebaseVersion}\n`);

    const firebaseEnv = {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: SERVICE_ACCOUNT
    };

    // Build the project before deploying
    execSync('yarn build', {
        cwd: TARGET_DIR,
        env: firebaseEnv,
        stdio: 'inherit'
    });
    
    console.log('\n[DEPLOY] Running firebase deploy...');
    execSync('firebase deploy', {
        cwd: TARGET_DIR,
        env: firebaseEnv,
        stdio: 'inherit'
    });

    console.log('\n============================================================');
    console.log('DEPLOY SUCCESS');
    console.log('============================================================');
    console.log(`Project: ${TEN_PROJECT}`);
    console.log(`URL: https://${TEN_PROJECT.toLowerCase()}.web.app/`);
    console.log('============================================================\n');
} catch (error) {
    console.error('\n============================================================');
    console.error('DEPLOY FAILED');
    console.error('============================================================');
    console.error(error.message || error.stderr || error.toString());
    console.error('');
    process.exit(1);
}

logStep('[10/9]', 'Cleaning up temporary directories...');
try {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
    console.log(`✓ Cleaned up temporary directory: ${TARGET_DIR}\n`);
} catch (error) {
    fail(`ERROR: Failed to clean up temporary directory: ${error.message}`);
}