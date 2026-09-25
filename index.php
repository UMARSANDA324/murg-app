<?php
/**
 * DECOMMISSIONED LEGACY INTERFACE: index.php
 * 
 * This interface has been decommissioned as part of the Strangler Fig migration.
 * The authoritative business interface is now hosted in the modern React application at:
 * http://localhost:5173/login
 * 
 * Safe HTTP 302 redirect ensures no broken bookmarks, direct URLs, or external links.
 */
session_start();
$isProxy = (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], '5173') !== false);
$target = $isProxy ? '/login' : 'http://localhost:5173/login';
header("Location: $target", true, 302);
exit();
