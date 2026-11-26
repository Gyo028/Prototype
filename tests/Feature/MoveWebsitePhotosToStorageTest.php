<?php

use App\Models\WebsiteContentImage;
use Database\Seeders\WebsiteContentSeeder;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->seed(WebsiteContentSeeder::class);
});

test('the command refuses to run while photos are kept on this computer', function () {
    config(['filesystems.website_disk' => 'public']);

    $this->artisan('website:photos-to-storage')->assertFailed();

    expect(WebsiteContentImage::where('file_path', 'like', '/%')->count())->toBe(33);
});

test('a dry run lists the photos without moving them', function () {
    config(['filesystems.website_disk' => 'website_test']);
    $disk = Storage::fake('website_test');

    $this->artisan('website:photos-to-storage', ['--dry-run' => true])->assertSuccessful();

    expect(WebsiteContentImage::where('file_path', 'like', '/%')->count())->toBe(33)
        ->and($disk->allFiles())->toBeEmpty();
});

test('the seeded photos move to the storage as WebP copies with thumbnails', function () {
    config(['filesystems.website_disk' => 'website_test']);
    $disk = Storage::fake('website_test');

    $before = WebsiteContentImage::query()->library()->where('title', 'Wellness Place')->firstOrFail();

    $this->artisan('website:photos-to-storage')->assertSuccessful();

    expect(WebsiteContentImage::where('file_path', 'like', '/%')->count())->toBe(0);

    $after = $before->fresh();
    expect($after->file_path)->toStartWith('website/')->toEndWith('.webp')
        ->and($after->homepage_order)->toBe($before->homepage_order) // carousel and showcase stay as they were
        ->and($after->showcase_order)->toBe($before->showcase_order);

    $disk->assertExists([$after->file_path, $after->thumb_path]);

    // Each row has its own file (replacing one photo later must not delete another's).
    expect(WebsiteContentImage::pluck('file_path')->unique()->count())->toBe(33)
        // The app files stay: the landing page still uses them.
        ->and(file_exists(public_path('images/works/work-14.webp')))->toBeTrue();

    // Running it again has nothing left to move.
    $this->artisan('website:photos-to-storage')->assertSuccessful();
});
