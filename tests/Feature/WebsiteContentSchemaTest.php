<?php

use App\Models\User;
use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

test('website content tables follow the ERD column names', function () {
    expect(Schema::getColumnListing('website_contents'))->toEqualCanonicalizing([
        'content_id', 'section', 'block_key', 'title', 'content', 'sort_order', 'updated_by', 'updated_at',
    ]);

    expect(Schema::getColumnListing('website_content_images'))->toEqualCanonicalizing([
        'image_id', 'content_id', 'file_path', 'alt_text', 'sort_order', 'status', 'updated_at',
    ]);
});

test('content is saved with updated_at only and its images are linked to it', function () {
    $content = WebsiteContent::create([
        'section' => WebsiteContent::SECTION_GALLERY,
        'block_key' => 'works',
        'title' => 'Our Works',
    ]);

    $content->images()->create(['file_path' => 'work-2.webp', 'alt_text' => 'Mall Activation', 'sort_order' => 2]);
    $content->images()->create(['file_path' => 'work-1.webp', 'alt_text' => 'Corporate Event', 'sort_order' => 1]);

    expect($content->updated_at)->not->toBeNull()
        ->and($content->images->pluck('file_path')->all())->toBe(['work-1.webp', 'work-2.webp'])
        ->and($content->images->first()->status)->toBe(WebsiteContentImage::STATUS_ACTIVE);
});

test('a block_key can only be used once, but list entries without one are unlimited', function () {
    WebsiteContent::create(['section' => 'homepage', 'block_key' => 'hero', 'title' => 'Hero']);

    WebsiteContent::create(['section' => 'faq', 'title' => 'Question one?']);
    WebsiteContent::create(['section' => 'faq', 'title' => 'Question two?']);

    expect(WebsiteContent::where('section', 'faq')->count())->toBe(2);

    WebsiteContent::create(['section' => 'homepage', 'block_key' => 'hero', 'title' => 'Another hero']);
})->throws(QueryException::class);

test('only the sections in the ERD are accepted', function () {
    WebsiteContent::create(['section' => 'blog', 'title' => 'Not a section']);
})->throws(QueryException::class);

test('deleting a user keeps the content and clears who updated it', function () {
    $admin = User::factory()->create();
    $content = WebsiteContent::create(['section' => 'faq', 'title' => 'Question?', 'updated_by' => $admin->id]);

    expect($content->updatedBy->is($admin))->toBeTrue();

    $admin->delete();

    expect($content->fresh()->updated_by)->toBeNull();
});

test('deleting content removes its images', function () {
    $content = WebsiteContent::create(['section' => 'gallery', 'block_key' => 'works', 'title' => 'Our Works']);
    $content->images()->create(['file_path' => 'work-1.webp']);

    $content->delete();

    expect(WebsiteContentImage::count())->toBe(0);
});