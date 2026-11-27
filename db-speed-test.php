<?php

/**
 * Measures how long it takes to reach the database, step by step.
 * Put this file in the project root (next to artisan) and run:
 *     php db-speed-test.php
 * Delete it when you're done. Don't commit it.
 */

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

function ms(float $start): string
{
    return str_pad(round((microtime(true) - $start) * 1000).' ms', 9, ' ', STR_PAD_LEFT);
}

$host = config('database.connections.'.config('database.default').'.host');
echo "Database host: {$host}\n\n";

// 1. DNS: turning the host name into an IP address
$t = microtime(true);
$ip = gethostbyname($host);
echo ms($t)."  DNS lookup ({$ip})\n";

// 2. Opening the connection (TCP + SSL + login), done once per request
$t = microtime(true);
DB::connection()->getPdo();
echo ms($t)."  Open connection\n";

// 3. Simple queries on the already-open connection (one round-trip each)
for ($i = 1; $i <= 3; $i++) {
    $t = microtime(true);
    DB::select('select 1');
    echo ms($t)."  Query #{$i} (select 1)\n";
}

// 4. A real query from the app
$t = microtime(true);
DB::table('users')->first();
echo ms($t)."  Query: first row of users\n";
