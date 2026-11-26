<?php

namespace App\Console\Commands;

use App\Models\WebsiteContentImage;
use App\Services\WebsitePhotos;
use App\Support\WebsiteDefaults;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Moves the website photos that still point to files shipped with the app
 * (public/images, seeded paths starting with "/") to the website photo
 * storage (WEBSITE_CONTENT_DISK, the public Supabase bucket), so every
 * Website Content photo lives in one place.
 *
 * Run once, by one person, after setting up the bucket (the database is shared):
 *
 *   php artisan website:photos-to-storage --dry-run   (lists what would move)
 *   php artisan website:photos-to-storage
 *
 * Each photo is converted the same way as an upload (WebP, resized, with a
 * thumbnail) and its row is updated. Every row gets its own copy, because
 * replacing a photo later deletes its old file. The files in public/images
 * are kept: the landing page still uses them until it is connected to the
 * database. Safe to run again: only rows still pointing to app files move.
 */
class MoveWebsitePhotosToStorage extends Command
{
    protected $signature = 'website:photos-to-storage
        {--dry-run : Only list what would be moved}';

    protected $description = 'Move the seeded website photos (public/images) to the website photo storage bucket';

    public function handle(WebsitePhotos $photos): int
    {
        $diskName = WebsiteContentImage::disk();
        $dryRun = (bool) $this->option('dry-run');

        if ($diskName === 'public') {
            $this->error('WEBSITE_CONTENT_DISK is "public" (this computer). Set it to supabase_website in .env, run php artisan config:clear, then try again.');

            return self::FAILURE;
        }

        try {
            Storage::disk($diskName)->fileExists('.connection-check');
        } catch (Throwable $e) {
            $this->error("Could not reach the \"{$diskName}\" storage: ".self::reason($e));
            $this->line('Check SUPABASE_S3_* and SUPABASE_WEBSITE_* in .env, then run php artisan config:clear.');

            return self::FAILURE;
        }

        $this->info("Connected to the \"{$diskName}\" storage.");

        $rows = WebsiteContentImage::query()
            ->with('content')
            ->where('file_path', 'like', '/%')
            ->orderBy('image_id')
            ->get();

        if ($rows->isEmpty()) {
            $this->info('Every website photo is already in the storage. Nothing to move.');

            return self::SUCCESS;
        }

        $this->info(($dryRun ? 'Would move ' : 'Moving ').$rows->count().' photo(s)…');

        $moved = $failed = 0;

        foreach ($rows as $row) {
            $label = $row->slot !== null
                ? "{$row->content?->block_key} / {$row->slot}"
                : 'Our Works / '.($row->title ?? $row->image_id);

            $source = public_path(ltrim($row->file_path, '/'));

            if (! is_file($source)) {
                $this->error("  missing  {$label}: {$row->file_path} is not in public/");
                $failed++;

                continue;
            }

            if ($dryRun) {
                $this->line("  move  {$label}  ({$row->file_path})");
                $moved++;

                continue;
            }

            try {
                $kind = $row->slot !== null
                    ? (WebsiteDefaults::SLOTS[$row->content?->block_key][$row->slot] ?? 'photo')
                    : 'photo';

                $paths = $photos->storeFrom($source, $kind, checkSize: false);

                // Keep "last updated" as it was: the photo itself did not change.
                $row->timestamps = false;
                $row->fill($paths)->save();

                $this->line("  moved  {$label}  →  {$paths['file_path']}");
                $moved++;
            } catch (Throwable $e) {
                $this->error("  failed  {$label}: ".self::reason($e));
                $failed++;
            }
        }

        $this->newLine();
        $this->info(($dryRun ? 'Would move' : 'Moved')." {$moved}, failed {$failed}.");

        if (! $dryRun && $failed > 0) {
            $this->line('Run the command again to retry the failed ones.');
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /** The underlying error (Flysystem wraps it and hides the real cause). */
    private static function reason(Throwable $e): string
    {
        while ($e->getPrevious() !== null) {
            $e = $e->getPrevious();
        }

        return mb_strimwidth(trim((string) strtok($e->getMessage(), "\n")), 0, 300, '…');
    }
}
