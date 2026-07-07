<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'jdm_ai' => [
        'url' => env('JDM_AI_URL', 'http://127.0.0.1:5000'),
        'descriptions_path' => env('JDM_AI_DESCRIPTIONS_PATH', base_path('../DoAnAI/descriptions')),
        'connect_timeout' => (int) env('JDM_AI_CONNECT_TIMEOUT', 15),
        'timeout' => (int) env('JDM_AI_TIMEOUT', 180),
    ],

    'vilao_llm' => [
        'url' => env('VILAO_LLM_URL', 'https://api.vilao.ai/v1'),
        'key' => env('VILAO_LLM_API_KEY'),
        'model' => env('VILAO_LLM_MODEL', 'botzalo'),
        'ca_bundle' => env('VILAO_LLM_CA_BUNDLE'),
    ],

    'momo' => [
        'endpoint' => env('MOMO_ENDPOINT', 'https://test-payment.momo.vn/v2/gateway/api/create'),
        'partner_code' => env('MOMO_PARTNER_CODE'),
        'access_key' => env('MOMO_ACCESS_KEY'),
        'secret_key' => env('MOMO_SECRET_KEY'),
    ],

    'vnpay' => [
        'tmn_code' => env('VNPAY_TMN_CODE'),
        'hash_secret' => env('VNPAY_HASH_SECRET'),
    ],

];
