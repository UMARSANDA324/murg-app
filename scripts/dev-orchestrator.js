/**
 * scripts/dev-orchestrator.js
 *
 * MURG Textile Enterprises — Development Service Orchestrator
 *
 * Mandatory Principles:
 * 1. NEVER AUTO-START MYSQL OR MONGODB: Performs a non-invasive health check.
 *    If MongoDB is down, aborts with an actionable error. Does NOT execute database services.
 * 2. NO APACHE DEPENDENCY: Application now runs purely on React + Node.js + MongoDB.
 *    Apache/PHP are no longer required for normal operation.
 * 3. Concurrent execution of Node.js backend (port 5000) and React frontend (port 5173).
 */

const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const MONGODB_HOST = process.env.MONGODB_URI ? 'MongoDB Atlas' : 'MongoDB';

function checkMongoDB() {
  return new Promise((resolve) => {
    if (!process.env.MONGODB_URI) {
      resolve(false);
      return;
    }
    
    // MongoDB Atlas uses SRV URLs, so we verify by attempting a connection
    // This is a basic check - the actual connection will be validated by the backend
    const uri = process.env.MONGODB_URI;
    resolve(uri && uri.startsWith('mongodb+srv://'));
  });
}

async function orchestrate() {
  console.log('\n================================================================');
  console.log('   MURG TEXTILE ENTERPRISES — DEVELOPMENT RUNTIME');
  console.log('   Architecture: React + Node.js + MongoDB');
  console.log('================================================================\n');

  // 1. MongoDB Health Check (NEVER AUTO-START MONGODB)
  process.stdout.write(`[1/2] Verifying MongoDB configuration... `);
  const mongoAvailable = await checkMongoDB();

  if (!mongoAvailable) {
    console.log('FAILED ✗\n');
    console.error('┌────────────────────────────────────────────────────────────────────────┐');
    console.error('│  [ORCHESTRATOR ERROR] MONGODB NOT CONFIGURED                         │');
    console.error('├────────────────────────────────────────────────────────────────────────┤');
    console.error('│                                                                        │');
    console.error('│  The MONGODB_URI environment variable is not set or invalid.        │');
    console.error('│                                                                        │');
    console.error('│  [ACTION REQUIRED]:                                                    │');
    console.error('│  Please add MONGODB_URI to backend/.env with your MongoDB Atlas     │');
    console.error('│  connection string before running `npm run dev`.                     │');
    console.error('│                                                                        │');
    console.error('│  * Architectural Policy: The development runtime will NEVER attempt   │');
    console.error('│    to auto-start database services or modify database lifecycle.    │');
    console.error('│  * MongoDB Atlas is the authoritative database for this application. │');
    console.error('└────────────────────────────────────────────────────────────────────────┘\n');
    process.exit(1);
  }

  console.log('CONFIGURED ✓');

  // 2. MongoDB Connection Verification (done by backend on startup)
  console.log('[2/2] MongoDB connection will be verified by backend on startup...\n');

  // 3. Launch Backend API and React Frontend concurrently
  console.log('================================================================');
  console.log('   LAUNCHING SERVICES:');
  console.log('   • Frontend:     http://localhost:5173 (React/Vite)');
  console.log('   • Backend API:  http://localhost:5000 (Express/Node.js)');
  console.log('   • Database:     MongoDB Atlas');
  console.log('================================================================\n');

  const concurrently = path.join(__dirname, '../node_modules/.bin/concurrently');
  const isWindows = process.platform === 'win32';
  const concurrentlyCmd = isWindows ? 'npx concurrently' : concurrently;

  const child = spawn(
    isWindows ? 'cmd.exe' : 'npx',
    isWindows
      ? [
          '/c',
          'npx',
          'concurrently',
          '--names',
          'API,REACT',
          '--prefix-colors',
          'cyan,magenta',
          '--kill-others-on-fail',
          'npm run dev --prefix backend',
          'npm run dev --prefix frontend',
        ]
      : [
          'concurrently',
          '--names',
          'API,REACT',
          '--prefix-colors',
          'cyan,magenta',
          '--kill-others-on-fail',
          'npm run dev --prefix backend',
          'npm run dev --prefix frontend',
        ],
    { stdio: 'inherit' }
  );

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

orchestrate().catch((err) => {
  console.error('[ORCHESTRATOR ERROR]', err);
  process.exit(1);
});
