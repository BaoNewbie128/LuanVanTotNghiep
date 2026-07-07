<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$backendPath = __DIR__.'/backend';

if (! is_file($backendPath.'/vendor/autoload.php')) {
    http_response_code(503);
    exit('Backend dependencies are missing. Run composer install in the backend directory.');
}

if (is_file($maintenance = $backendPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backendPath.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $backendPath.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);
$app->handleRequest(Request::capture());

