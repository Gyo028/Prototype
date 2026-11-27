<?php

use App\Enums\Role;
use App\Models\User;
use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use App\Support\WebsiteDefaults;
use Database\Seeders\WebsiteContentSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
});

test('the landing page shows the Website Content', function () {
    $this->seed(WebsiteContentSeeder::class);

    WebsiteContent::where('block_key', 'about')->update(['content' => "First paragraph.\n\nSecond paragraph."]);

    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('public/landing')
            ->where('hero.url', '/images/hero-bg.webp')
            ->where('about.paragraphs', ['First paragraph.', 'Second paragraph.'])
            ->has('about.photos', 3)
            ->has('services', 3)
            ->where('services.2.title', 'Custom Projects')
            ->where('services.2.href', '/services/custom-fabrication')
            ->has('carousel', 10)
            ->where('carousel.0.title', 'Wellness Place')
            ->where('contact.phone', '09175352156')
            ->where('contact.email', 'gr3ataseventsstyling@gmail.com')
        );
});

test('the pages still show the original content when Website Content is empty', function () {
    $this->get(route('home'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('hero.url', '/images/hero-bg.webp')
            ->where('about.paragraphs', WebsiteDefaults::ABOUT)
            ->has('services', 3)
            ->has('carousel', 0)
            ->where('contact.address', WebsiteDefaults::CONTACT['address'])
        );

    $this->get(route('services.special-occasions'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('hero.url', '/images/hero-bg5.webp'));
});

test('hidden photos are left out and the carousel follows its order', function () {
    $this->seed(WebsiteContentSeeder::class);

    $first = WebsiteContentImage::query()->library()->where('homepage_order', 1)->firstOrFail();
    WebsiteContentImage::query()->library()->where('homepage_order', 2)->update(['homepage_order' => 1]);
    $first->update(['homepage_order' => 2]);

    $hidden = WebsiteContentImage::query()->library()->whereNull('homepage_order')->whereNull('showcase_order')->firstOrFail();
    $hidden->update(['status' => 'inactive']);

    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('carousel.1.id', $first->image_id));

    $this->get(route('our-works'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('public/our-works')
            ->has('works', 19)
            ->has('categories', 3)
            ->where('works', fn ($works) => collect($works)->doesntContain('id', $hidden->image_id))
        );
});

test('each service page shows its photos, its 4 showcase photos and the other two services', function (string $route, string $component, string $category) {
    $this->seed(WebsiteContentSeeder::class);

    $this->get(route($route))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component($component)
            ->has('intro', 2)
            ->has('showcase', 4)
            ->where('showcase', fn ($tiles) => collect($tiles)->every(
                fn ($tile) => WebsiteContentImage::find($tile['id'])->category === $category,
            ))
            ->has('moreServices', 2)
            ->where('contact.phone', '09175352156')
        );
})->with([
    'corporate' => ['services.corporate-events', 'public/corporate-events', 'corporate_events'],
    'special' => ['services.special-occasions', 'public/special-occasions', 'special_occasions'],
    'custom' => ['services.custom-fabrication', 'public/custom-fabrication', 'custom_projects'],
]);

test('the More services cards use the photos the pages had', function () {
    $this->seed(WebsiteContentSeeder::class);

    $this->get(route('services.corporate-events'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('moreServices.0.title', 'Special Occasions')
            ->where('moreServices.0.image', '/images/works/work-7.webp')
            ->where('moreServices.1.title', 'Custom Projects')
            ->where('moreServices.1.image', '/images/works/work-8.webp')
        );

    $this->get(route('services.special-occasions'))
        ->assertInertia(fn (Assert $page) => $page->where('moreServices.0.image', '/images/works/work-3.webp'));
});

test('the FAQ page shows the questions in the admin order', function () {
    $this->seed(WebsiteContentSeeder::class);

    $last = WebsiteContent::where('section', 'faq')->orderByDesc('sort_order')->firstOrFail();
    $last->update(['sort_order' => 0]);

    $this->get(route('faq'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('public/faq')
            ->has('faqs', 6)
            ->where('faqs.0.id', $last->content_id)
        );
});

test('a social link the admin cleared stays hidden', function () {
    $this->seed(WebsiteContentSeeder::class);

    $contact = json_decode(WebsiteContent::where('block_key', 'contact')->value('content'), true);
    WebsiteContent::where('block_key', 'contact')->update(['content' => json_encode([...$contact, 'facebook' => ''])]);

    $this->get(route('terms'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('contact.facebook', ''));
});

test('the public pages are cached, and an admin change shows on the next visit', function () {
    $this->seed(WebsiteContentSeeder::class);
    $admin = User::factory()->create(['role' => Role::TechnicalAdmin]);

    // First visit fills the cache; a direct database change (no model events) isn't seen yet.
    $this->get(route('home'))->assertOk();
    WebsiteContent::where('block_key', 'about')->update(['content' => "Changed behind the cache.\n\nSecond."]);
    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->where('about.paragraphs', fn ($p) => collect($p)->doesntContain('Changed behind the cache.')));

    // Saving through the Website Content page clears it: the change shows right away.
    $this->actingAs($admin)
        ->put(route('technical-admin.website-content.about'), ['first' => 'New first paragraph.', 'second' => 'New second paragraph.'])
        ->assertSessionHasNoErrors();
    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->where('about.paragraphs', ['New first paragraph.', 'New second paragraph.']));

    // So does a carousel reorder, which updates many rows at once (no model events).
    $ids = WebsiteContentImage::query()->library()->whereNotNull('homepage_order')->orderBy('homepage_order')->pluck('image_id')->all();
    $this->put(route('technical-admin.website-content.works.carousel'), ['ids' => array_reverse($ids)])
        ->assertSessionHasNoErrors();
    $this->get(route('home'))->assertInertia(fn (Assert $page) => $page
        ->where('carousel.0.id', end($ids)));
});

