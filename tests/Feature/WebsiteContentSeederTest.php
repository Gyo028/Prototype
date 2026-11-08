<?php

use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use Database\Seeders\WebsiteContentSeeder;

test('the seeder loads the current landing page content', function () {
    $this->seed(WebsiteContentSeeder::class);

    expect(WebsiteContent::where('section', 'homepage')->orderBy('sort_order')->pluck('block_key')->all())
        ->toBe(['hero', 'about', 'contact'])
        ->and(WebsiteContent::where('section', 'services')->count())->toBe(4) // heading + 3 cards
        ->and(WebsiteContent::where('section', 'faq')->count())->toBe(6)
        ->and(WebsiteContent::where('section', 'gallery')->count())->toBe(1)
        ->and(WebsiteContentImage::count())->toBe(10);

    $works = WebsiteContent::where('block_key', 'works')->firstOrFail();

    expect($works->images->first()->file_path)->toBe('/images/works/work-1.webp')
        ->and($works->images->last()->file_path)->toBe('/images/works/work-10.webp');
});

test('the hero and contact blocks are stored as readable JSON', function () {
    $this->seed(WebsiteContentSeeder::class);

    $hero = json_decode(WebsiteContent::where('block_key', 'hero')->value('content'), true);
    $contact = json_decode(WebsiteContent::where('block_key', 'contact')->value('content'), true);

    expect($hero)->toHaveKeys(['headline', 'highlight', 'subheadline', 'button'])
        ->and($hero['button'])->toBe('Start Project')
        ->and($contact)->toHaveKeys(['phone', 'email', 'address', 'facebook', 'instagram', 'copyright'])
        ->and($contact['copyright'])->toContain('©');
});

test('FAQ questions fit the title column', function () {
    $this->seed(WebsiteContentSeeder::class);

    expect(WebsiteContent::where('section', 'faq')->pluck('title')->map(fn ($t) => mb_strlen($t))->max())
        ->toBeLessThanOrEqual(150);
});

test('running the seeder again changes nothing, so admin edits are never overwritten', function () {
    $this->seed(WebsiteContentSeeder::class);

    WebsiteContent::where('block_key', 'about')->update(['title' => 'Who We Are']);

    $this->seed(WebsiteContentSeeder::class);

    expect(WebsiteContent::count())->toBe(14) // 3 homepage + 4 services + 1 gallery + 6 faq
        ->and(WebsiteContent::where('block_key', 'about')->value('title'))->toBe('Who We Are');
});