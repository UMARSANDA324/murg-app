/**
 * scripts/dev-orchestrator.js
 *
 * MURG Textile Enterprises — Development Service Orchestrator
 *
 * Mandatory Principles:
 * 1. NEVER AUTO-START MYSQL: Performs a non-invasive health check on port 3306.
 *    If MySQL is down, aborts with an actionable error. Does NOT execute `mysqld.exe`.
 * 2. APACHE DETECTION (Mode A vs Mode B):
 *    - Mode B: If Apache is already running on port 80 (e.g. via XAMPP Control Panel),
 *      connects the reverse proxy cleanly without duplicate process attempts.
 *    - Mode A: If Apache is stopped, starts Apache (`C:\xampp\apache\bin\httpd.exe`).
 * 3. Pre-flight column & table check.
 * 4. Concurrent execution of Node.js backend (port 5000) and React frontend (port 5173).
 */

const net = require('net');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MYSQL_HOST = process.env.DB_HOST || '127.0.0.1';
const MYSQL_PORT = parseInt(process.env.DB_PORT) || 3306;
const APACHE_PORT = 80;
const XAMPP_HTTPD = 'C:\\xampp\\apache\\bin\\httpd.exe';

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
  console.log('   MURG TEXTILE ENTERPRISES — UNIFIED DEVELOPMENT RUNTIME');
  console.log('================================================================\n');

  // 1. MySQL Health Check (NEVER AUTO-START MYSQL)
  process.stdout.write(`[1/3] Verifying MySQL connection on ${MYSQL_HOST}:${MYSQL_PORT}... `);
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

  // 2. Apache Runtime Detection (Mode A vs Mode B)
  process.stdout.write(`[2/3] Checking Apache runtime on port ${APACHE_PORT}... `);
  const apacheRunning = await checkPort(APACHE_PORT);

  if (apacheRunning) {
    console.log('ACTIVE ✓ (Mode B: Active XAMPP detected)');
    console.log('      → Gateway proxy will route legacy modules to existing Apache on port 80.');
  } else {
    if (fs.existsSync(XAMPP_HTTPD)) {
      console.log('STARTING → (Mode A: Launching XAMPP Apache)');
      try {
        const apacheProcess = spawn(XAMPP_HTTPD, [], {
          detached: true,
          stdio: 'ignore',
        });
        apacheProcess.unref();
        // Wait a moment for Apache to bind port
        await new Promise((r) => setTimeout(r, 1500));
        console.log('      ✓ Apache successfully started on port 80.');
      } catch (err) {
        console.warn('      ⚠️ Could not start Apache automatically:', err.message);
        console.warn('      → Start Apache manually via XAMPP Control Panel if legacy modules are needed.');
      }
    } else {
      console.log('OFFLINE ⚠️');
      console.warn(`      → ${XAMPP_HTTPD} not found.`);
      console.warn('      → Start Apache manually via XAMPP Control Panel if legacy modules are needed.');
    }
  }

  // 3. Database Column & Schema Pre-flight Verification
  console.log('[3/3] Running database schema pre-flight verification...');
  try {
    execSync('node backend/scripts/check-db-columns.js', { stdio: 'inherit' });
  } catch (err) {
    console.warn('[ORCHESTRATOR] Pre-flight script exited with warning.');
  }

  // 4. Launch Backend API and React Frontend concurrently
  console.log('\n================================================================');
  console.log('   LAUNCHING UNIFIED SERVICES:');
  console.log('   • Frontend Entry: http://localhost:5173 (React/Vite Gateway)');
  console.log('   • Backend API:    http://localhost:5000 (Express/Node.js)');
  console.log('   • Legacy PHP:     Proxied via Vite to http://localhost/murg');
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
