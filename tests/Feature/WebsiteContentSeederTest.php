<?php

use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use App\Support\WebsiteDefaults;
use Database\Seeders\WebsiteContentSeeder;

test('the seeder loads the current landing page content', function () {
    $this->seed(WebsiteContentSeeder::class);

    expect(WebsiteContent::where('section', 'homepage')->orderBy('sort_order')->pluck('block_key')->all())
        ->toBe(['hero', 'about', 'contact'])
        ->and(WebsiteContent::where('section', 'services')->count())->toBe(7) // heading + 3 cards + 3 service pages
        ->and(WebsiteContent::where('section', 'faq')->count())->toBe(6)
        ->and(WebsiteContent::where('section', 'gallery')->count())->toBe(1)
        ->and(WebsiteContentImage::whereNotNull('slot')->count())->toBe(13) // hero + 3 about + 3 x 3 service page photos
        ->and(WebsiteContentImage::query()->library()->count())->toBe(20);
});

test('the photo library starts with the carousel and the three showcases filled', function () {
    $this->seed(WebsiteContentSeeder::class);

    $library = WebsiteContentImage::query()->library()->get();

    expect($library->whereNotNull('homepage_order')->sortBy('homepage_order')->pluck('homepage_order')->values()->all())
        ->toBe(range(1, 10));

    foreach (WebsiteDefaults::CATEGORIES as $category => $label) {
        expect($library->where('category', $category)->whereNotNull('showcase_order')->pluck('showcase_order')->sort()->values()->all())
            ->toBe([1, 2, 3, 4]);
    }

    expect($library->every(fn ($photo) => mb_strlen($photo->title) <= 30 && mb_strlen((string) $photo->caption) <= 32))->toBeTrue()
        ->and($library->every(fn ($photo) => file_exists(public_path(ltrim($photo->file_path, '/')))))->toBeTrue();
});

test('the hero keeps only its photo and the About Us text fits its limits', function () {
    $this->seed(WebsiteContentSeeder::class);

    $about = explode("\n\n", (string) WebsiteContent::where('block_key', 'about')->value('content'));
    $contact = json_decode(WebsiteContent::where('block_key', 'contact')->value('content'), true);

    expect(WebsiteContent::where('block_key', 'hero')->value('content'))->toBeNull()
        ->and($about)->toHaveCount(2)
        ->and(mb_strlen($about[0]))->toBeLessThanOrEqual(180)
        ->and(mb_strlen($about[1]))->toBeLessThanOrEqual(420)
        ->and($contact)->toHaveKeys(['phone', 'email', 'address', 'facebook', 'instagram', 'copyright']);
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

    expect(WebsiteContent::count())->toBe(17) // 3 homepage + 7 services + 1 gallery + 6 faq
        ->and(WebsiteContent::where('block_key', 'about')->value('title'))->toBe('Who We Are');
});