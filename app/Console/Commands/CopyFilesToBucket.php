<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Copies the customer and project files saved on this computer (the "local"
 * disk, storage/app/private) to the team's Supabase Storage bucket, at the
 * same paths, so the records that point to them keep working.
 *
 * Run once per computer after setting up the bucket:
 *
 *   php artisan files:copy-to-bucket --dry-run   (lists what would be copied)
 *   php artisan files:copy-to-bucket
 *
 * A file already in the bucket at the same path and size is skipped (a
 * groupmate may have copied it already); --force copies it again. Nothing
 * is deleted from this computer.
 */
class CopyFilesToBucket extends Command
{
    protected $signature = 'files:copy-to-bucket
        {--from=local : The disk to copy from}
        {--to=supabase : The disk to copy to}
        {--force : Copy files the bucket already has}
        {--dry-run : Only list what would be copied}';

    protected $description = 'Copy the customer and project files on this computer to the Supabase Storage bucket';

    public function handle(): int
    {
        $from = Storage::disk((string) $this->option('from'));
        $to = Storage::disk((string) $this->option('to'));
        $dryRun = (bool) $this->option('dry-run');

        $files = collect($from->allFiles())
            ->reject(fn (string $path) => str_starts_with(basename($path), '.'))
            ->values();

        if ($files->isEmpty()) {
            $this->info('No files to copy.');

            return self::SUCCESS;
        }

        $this->info(($dryRun ? 'Would check ' : 'Checking ').$files->count().' file(s)…');

        $copied = $skipped = $failed = 0;

        foreach ($files as $path) {
            try {
                if (! $this->option('force') && $to->exists($path) && $to->size($path) === $from->size($path)) {
                    $skipped++;

                    continue;
                }

                if ($dryRun) {
                    $this->line("  copy  {$path}");
                    $copied++;

                    continue;
                }

                $stream = $from->readStream($path);
                $to->writeStream($path, $stream);

                if (is_resource($stream)) {
                    fclose($stream);
                }

                $this->line("  copied  {$path}");
                $copied++;
            } catch (Throwable $e) {
                $this->error("  failed  {$path}: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->newLine();
        $this->info(($dryRun ? 'Would copy' : 'Copied')." {$copied}, skipped {$skipped} already in the bucket, failed {$failed}.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
