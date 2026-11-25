<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    | E-VenturePro: customer and project files (request attachments, receipts,
    | dispute proof, site access documents, site assessments, design proposals,
    | contracts, completion photos) all use the default disk, under
    | customers/{customer_id}/... Set FILESYSTEM_DISK=supabase to keep them in
    | the private Supabase Storage bucket (the team shares one, like the
    | database); "local" keeps them on this computer. Tests always use "local"
    | (phpunit.xml). Landing page images stay in public/images.
    */

    /*
    | Website Content photos the Technical Admin uploads (hero, About Us,
    | service pages, Our Works). Public photos, so a public disk: "public"
    | keeps them in storage/app/public (run `php artisan storage:link` once).
    | Where they live in production is decided once the host is chosen.
    | The photos shipped with the app stay in public/images.
    */

    'website_disk' => env('WEBSITE_CONTENT_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim((string) env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // Supabase Storage through its S3-compatible endpoint (private bucket).
        // Needs: composer require league/flysystem-aws-s3-v3 "^3.0"
        // Keys: Supabase dashboard > Storage > S3 Configuration. Server-side only.
        'supabase' => [
            'driver' => 's3',
            'key' => env('SUPABASE_S3_ACCESS_KEY_ID'),
            'secret' => env('SUPABASE_S3_SECRET_ACCESS_KEY'),
            'region' => env('SUPABASE_S3_REGION'),
            'bucket' => env('SUPABASE_S3_BUCKET'),
            // https://<project-ref>.storage.supabase.co/storage/v1/s3
            'endpoint' => env('SUPABASE_S3_ENDPOINT'),
            'use_path_style_endpoint' => true,
            'visibility' => 'private',
            // Report a failed upload instead of carrying on as if the file was saved.
            'throw' => true,
            'report' => true,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
