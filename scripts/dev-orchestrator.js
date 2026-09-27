/**
 * scripts/dev-orchestrator.js
 *
 * MURG Textile Enterprises — Development Service Orchestrator
 *
 * Mandatory Principles:
 * 1. NEVER AUTO-START MYSQL: Performs a non-invasive health check on port 3306.
 *    If MySQL is down, aborts with an actionable error. Does NOT execute `mysqld.exe`.
 * 2. NO APACHE DEPENDENCY: Application now runs purely on React + Node.js + MySQL.
 *    Apache/PHP are no longer required for normal operation.
 * 3. Pre-flight column & table check.
 * 4. Concurrent execution of Node.js backend (port 5000) and React frontend (port 5173).
 */

const net = require('net');
const { spawn, execSync } = require('child_process');
const path = require('path');

const MYSQL_HOST = process.env.DB_HOST || '127.0.0.1';
const MYSQL_PORT = parseInt(process.env.DB_PORT) || 3306;

function checkPort(port, host = '127.0.0.1', timeout = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function orchestrate() {
  console.log('\n================================================================');
  console.log('   MURG TEXTILE ENTERPRISES — DEVELOPMENT RUNTIME');
  console.log('   Architecture: React + Node.js + MySQL (Pure)');
  console.log('================================================================\n');

  // 1. MySQL Health Check (NEVER AUTO-START MYSQL)
  process.stdout.write(`[1/2] Verifying MySQL connection on ${MYSQL_HOST}:${MYSQL_PORT}... `);
  const mysqlAvailable = await checkPort(MYSQL_PORT, MYSQL_HOST);

  if (!mysqlAvailable) {
    console.log('FAILED ✗\n');
    console.error('┌────────────────────────────────────────────────────────────────────────┐');
    console.error('│  [ORCHESTRATOR ERROR] MYSQL DATABASE IS NOT REACHABLE                 │');
    console.error('├────────────────────────────────────────────────────────────────────────┤');
    console.error('│                                                                        │');
    console.error('│  The configured MySQL/MariaDB service is not listening on port 3306.   │');
    console.error('│                                                                        │');
    console.error('│  [ACTION REQUIRED]:                                                    │');
    console.error('│  Please start MySQL manually via XAMPP Control Panel or Windows Service│');
    console.error('│  before running `npm run dev`.                                         │');
    console.error('│                                                                        │');
    console.error('│  * Architectural Policy: The development runtime will NEVER attempt   │');
    console.error('│    to auto-start `mysqld.exe` or modify database lifecycle.            │');
    console.error('│  * The existing MySQL database remains the authoritative single source│');
    console.error('│    of truth.                                                           │');
    console.error('└────────────────────────────────────────────────────────────────────────┘\n');
    process.exit(1);
  }

  console.log('ONLINE ✓');

  // 2. Database Column & Schema Pre-flight Verification
  console.log('[2/2] Running database schema pre-flight verification...');
  try {
    execSync('node backend/scripts/check-db-columns.js', { stdio: 'inherit' });
  } catch (err) {
    console.warn('[ORCHESTRATOR] Pre-flight script exited with warning.');
  }

  // 3. Launch Backend API and React Frontend concurrently
  console.log('\n================================================================');
  console.log('   LAUNCHING SERVICES:');
  console.log('   • Frontend:     http://localhost:5173 (React/Vite)');
  console.log('   • Backend API:  http://localhost:5000 (Express/Node.js)');
  console.log('   • Database:     MySQL (External Service)');
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
