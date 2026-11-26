<?php

use App\Enums\Role;
use App\Models\User;
use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use Database\Seeders\WebsiteContentSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->withoutVite();
    $this->seed(WebsiteContentSeeder::class);
    $this->disk = Storage::fake('public');
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function libraryPhoto(string $title): WebsiteContentImage
{
    return WebsiteContentImage::query()->library()->where('title', $title)->firstOrFail();
}

function newWork(array $overrides = []): array
{
    return array_merge([
        'photo' => UploadedFile::fake()->image('booth.jpg', 1400, 1000),
        'title' => 'New Brand Booth',
        'caption' => 'Brand activation',
        'category' => 'corporate_events',
        'alt_text' => '',
    ], $overrides);
}

/* ---------------- Fixed photo slots ---------------- */

test('a slot photo is converted to WebP, scaled down, and replaces the old one', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.photos.update', ['hero', 'hero']), [
            'photo' => UploadedFile::fake()->image('hero.png', 2400, 1200),
        ])
        ->assertRedirect(route('technical-admin.website-content'))
        ->assertSessionHasNoErrors();

    $hero = WebsiteContent::where('block_key', 'hero')->firstOrFail()->images()->where('slot', 'hero')->firstOrFail();

    expect($hero->file_path)->toEndWith('.webp')
        ->and($hero->alt_text)->not->toBeEmpty(); // kept from before

    $this->disk->assertExists([$hero->file_path, $hero->thumb_path]);

    [$width, $height, $type] = getimagesize($this->disk->path($hero->file_path));
    expect($width)->toBe(1920)->and($height)->toBe(960)->and($type)->toBe(IMAGETYPE_WEBP);

    // Replacing it again removes the first upload.
    $first = $hero->file_path;
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.photos.update', ['hero', 'hero']), [
            'photo' => UploadedFile::fake()->image('hero2.jpg', 1600, 900),
        ])
        ->assertSessionHasNoErrors();

    $this->disk->assertMissing($first);
});

test('a banner must be a wide photo of a usable size', function (int $width, int $height) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.photos.update', ['svc_corporate', 'hero']), [
            'photo' => UploadedFile::fake()->image('banner.jpg', $width, $height),
        ])
        ->assertSessionHasErrors('photo');
})->with([
    'portrait' => [1000, 1400],
    'too small' => [800, 500],
]);

test('slot uploads accept only JPG, PNG or WEBP up to 5 MB, and only known slots', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.photos.update', ['about', 'about_1']), [
            'photo' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
        ])
        ->assertSessionHasErrors('photo');

    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.photos.update', ['about', 'about_9']), [
            'photo' => UploadedFile::fake()->image('a.jpg', 1000, 800),
        ])
        ->assertNotFound();
});

test('only the Technical Admin can upload website photos', function () {
    $customer = User::factory()->create(['role' => Role::Customer]);

    $this->actingAs($customer)
        ->post(route('technical-admin.website-content.works.store'), newWork())
        ->assertForbidden();
});

/* ---------------- Our Works library ---------------- */

test('a new Our Works photo is added to the library and can go on the carousel', function () {
    // Make room on the carousel first (it is full after seeding).
    $ids = WebsiteContentImage::query()->library()->whereNotNull('homepage_order')->orderBy('homepage_order')->pluck('image_id');
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.works.carousel'), ['ids' => $ids->take(9)->all()])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.works.store'), newWork(['add_to_carousel' => '1']))
        ->assertSessionHasNoErrors();

    $photo = libraryPhoto('New Brand Booth');

    expect($photo->category)->toBe('corporate_events')
        ->and($photo->alt_text)->toBe('New Brand Booth') // falls back to the title
        ->and($photo->homepage_order)->toBe(10)
        ->and($photo->status)->toBe('active');

    $this->disk->assertExists($photo->file_path);
});

test('the carousel holds at most 10 photos', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.works.store'), newWork(['add_to_carousel' => '1']))
        ->assertSessionHasErrors('add_to_carousel');

    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.works.carousel'), [
            'ids' => WebsiteContentImage::query()->library()->limit(11)->pluck('image_id')->all(),
        ])
        ->assertSessionHasErrors('ids');
});

test('Our Works photos need a title and category within the limits', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.works.store'), newWork([
            'title' => str_repeat('a', 31),
            'caption' => str_repeat('a', 33),
            'category' => 'mall_activation',
        ]))
        ->assertSessionHasErrors(['title', 'caption', 'category']);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.works.store'), newWork([
            'photo' => UploadedFile::fake()->image('tiny.jpg', 500, 400),
        ]))
        ->assertSessionHasErrors('photo');
});

test('a photo can be edited without uploading it again', function () {
    $photo = libraryPhoto('Gala Night');

    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.works.update', $photo), [
            'title' => 'Gala Night 2026',
            'caption' => '',
            'category' => 'special_occasions',
        ])
        ->assertSessionHasNoErrors();

    expect($photo->fresh())
        ->title->toBe('Gala Night 2026')
        ->caption->toBeNull()
        ->category->toBe('special_occasions')
        ->file_path->toBe('/images/works/work-2.webp');
});

test('a photo in a showcase keeps its category until it is replaced there', function () {
    $photo = libraryPhoto('The Grand Entrance'); // Corporate Events showcase

    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.works.update', $photo), [
            'title' => 'The Grand Entrance',
            'category' => 'custom_projects',
        ])
        ->assertSessionHasErrors('category');
});

test('a photo in use cannot be hidden or deleted; a hidden unused one can be deleted', function () {
    $inUse = libraryPhoto('Wellness Place');

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.works.status', $inUse), ['status' => 'inactive'])
        ->assertSessionHasErrors('photo');

    // An uploaded photo that is not used anywhere.
    $this->actingAs($this->admin)->post(route('technical-admin.website-content.works.store'), newWork());
    $photo = libraryPhoto('New Brand Booth');

    $this->actingAs($this->admin)
        ->delete(route('technical-admin.website-content.works.destroy', $photo))
        ->assertSessionHasErrors('photo'); // must be hidden first

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.works.status', $photo), ['status' => 'inactive'])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->delete(route('technical-admin.website-content.works.destroy', $photo))
        ->assertSessionHasNoErrors();

    expect(WebsiteContentImage::find($photo->image_id))->toBeNull();
    $this->disk->assertMissing([$photo->file_path, $photo->thumb_path]);
});

test('a showcase takes exactly 4 shown photos from its own category', function () {
    $corporate = WebsiteContentImage::query()->library()->where('category', 'corporate_events')->orderBy('sort_order')->pluck('image_id');

    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.showcases.update', 'svc_corporate'), ['ids' => $corporate->take(3)->all()])
        ->assertSessionHasErrors('ids');

    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.showcases.update', 'svc_corporate'), [
            'ids' => [...$corporate->take(3)->all(), libraryPhoto('Golden Moments')->image_id],
        ])
        ->assertSessionHasErrors('ids');

    $picked = $corporate->reverse()->take(4)->values()->all();

    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.showcases.update', 'svc_corporate'), ['ids' => $picked])
        ->assertSessionHasNoErrors();

    expect(WebsiteContentImage::query()->library()->where('category', 'corporate_events')->whereNotNull('showcase_order')
        ->orderBy('showcase_order')->pluck('image_id')->all())->toBe($picked);
});

test('slot photos cannot be changed through the Our Works routes', function () {
    $slot = WebsiteContentImage::whereNotNull('slot')->firstOrFail();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.works.status', $slot), ['status' => 'inactive'])
        ->assertNotFound();
});
