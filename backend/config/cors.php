<?php

$origins = array_filter(array_map(
    static fn (string $origin) => rtrim(trim($origin), '/'),
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'))
));

$frontendUrl = rtrim((string) env('FRONTEND_URL', ''), '/');
if ($frontendUrl !== '') {
    $origins[] = $frontendUrl;
}

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique($origins)),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => true,
    'frontend_url' => $frontendUrl,
];
