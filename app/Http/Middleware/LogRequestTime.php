<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Logs how long each request takes, plus every DB query run during it.
 * Register this ONLY in local/dev — it adds overhead and noise in production.
 */
class LogRequestTime
{
    public function handle(Request $request, Closure $next)
    {
        // Only measure on your local machine, never in production
        if (! app()->isLocal()) {
            return $next($request);
        }

        $start = microtime(true);

        // Start capturing every query fired during this request
        $queries = [];
        DB::listen(function ($query) use (&$queries) {
            $queries[] = [
                'sql' => $query->sql,
                'time_ms' => $query->time,
            ];
        });

        $response = $next($request);

        $totalMs = round((microtime(true) - $start) * 1000, 2);

        // Log the overall request time
        Log::info(sprintf(
            '[REQUEST] %s %s -> %d | %s ms',
            $request->method(),
            $request->path(),
            $response->getStatusCode(),
            $totalMs
        ));

        // Log each query run during the request, slowest first
        usort($queries, fn ($a, $b) => $b['time_ms'] <=> $a['time_ms']);
        foreach ($queries as $q) {
            Log::info(sprintf('  [QUERY] %s ms | %s', $q['time_ms'], $q['sql']));
        }

        // Flag anything suspiciously slow so it's easy to grep for
        if ($totalMs > 1000) {
            Log::warning(sprintf(
                '[SLOW REQUEST] %s %s took %s ms (%d queries)',
                $request->method(),
                $request->path(),
                $totalMs,
                count($queries)
            ));
        }

        return $response;
    }
}
