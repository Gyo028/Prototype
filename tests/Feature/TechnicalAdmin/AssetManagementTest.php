<?php

use App\Enums\Role;
use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function eventTypeId(string $name = 'Wedding'): int
{
    return EventType::where('event_type_name', $name)->value('event_type_id');
}

function validTheme(array $overrides = []): array
{
    return array_merge([
        'name' => 'Tropical Night',
        'eventTypeId' => eventTypeId(),
        'venue' => 'outdoor',
        'style' => 'Bohemian',
        'maxGuests' => 120,
        'active' => true,
    ], $overrides);
}

function validAsset(array $overrides = []): array
{
    return array_merge([
        'name' => 'Ghost Chairs',
        'category' => 'Furniture',
        'price' => '180.50',
        'pricingType' => 'per_guest',
        'guestsPerUnit' => 1,
        'active' => true,
    ], $overrides);
}

function chairs(): LayoutAsset
{
    return LayoutAsset::where('asset_name', 'Chiavari Chairs')->firstOrFail();
}

test('only the Technical Admin can change themes and assets', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->post(route('technical-admin.services-assets.themes.store'), validTheme())->assertForbidden();
    $this->actingAs($user)->post(route('technical-admin.services-assets.assets.store'), validAsset())->assertForbidden();
})->with([Role::Customer, Role::DesignSpecialist]);

test('the screen sends themes, event types, styles, and assets with their price', function () {
    LayoutAsset::where('asset_name', 'Uplighting')->update(['price' => null]);

    $this->actingAs($this->admin)
        ->get(route('technical-admin.services-assets'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('themes', 8)
            ->has('eventTypes', 4)
            ->where('styles', DesignTheme::STYLES)
            ->has('assets', 8)
            ->where('assetCategories', LayoutAsset::CATEGORIES)
            ->where('assets.0.name', 'Chiavari Chairs')
            ->where('assets.0.price', fn ($price) => (float) $price === 45.0)
            ->where('assets.0.pricingType', 'per_guest')
            ->where('assets.0.guestsPerUnit', 1)
            ->where('assets.2.pricingType', 'fixed')
            ->where('assets.7.name', 'Uplighting')
            ->where('assets.7.price', null)
        );
});

/* ---------------- Design themes ---------------- */

test('a design theme can be added and edited', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.themes.store'), validTheme())
        ->assertRedirect(route('technical-admin.services-assets'))
        ->assertSessionHasNoErrors();

    $theme = DesignTheme::where('theme_name', 'Tropical Night')->firstOrFail();

    expect($theme->eventType->event_type_name)->toBe('Wedding')
        ->and($theme->venue)->toBe('outdoor')
        ->and($theme->max_guests)->toBe(120);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.themes.update', $theme), validTheme([
            'eventTypeId' => eventTypeId('Debut'),
            'venue' => 'indoor',
            'maxGuests' => 90,
            'active' => false,
        ]))
        ->assertSessionHasNoErrors();

    $theme->refresh();

    expect($theme->eventType->event_type_name)->toBe('Debut')
        ->and($theme->venue)->toBe('indoor')
        ->and($theme->max_guests)->toBe(90)
        ->and($theme->status)->toBe('inactive');
});

test('incomplete or invalid themes are not saved', function (array $override, string $error) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.themes.store'), validTheme($override))
        ->assertSessionHasErrors($error);

    expect(DesignTheme::count())->toBe(8);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'duplicate name, other case' => [['name' => 'garden romance'], 'name'],
    'unknown event type' => [['eventTypeId' => 9999], 'eventTypeId'],
    'unknown venue' => [['venue' => 'rooftop'], 'venue'],
    'unknown style' => [['style' => 'Gothic'], 'style'],
    'zero guests' => [['maxGuests' => 0], 'maxGuests'],
    'missing guests' => [['maxGuests' => ''], 'maxGuests'],
]);

test('a theme keeps its own name when edited', function () {
    $theme = DesignTheme::where('theme_name', 'Garden Romance')->firstOrFail();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.themes.update', $theme), validTheme(['name' => 'Garden Romance']))
        ->assertSessionHasNoErrors();
});

test('a theme can be switched off and on', function () {
    $theme = DesignTheme::where('theme_name', 'Party Corner')->firstOrFail();

    $this->actingAs($this->admin)->patch(route('technical-admin.services-assets.themes.status', $theme), ['active' => false]);
    expect($theme->fresh()->status)->toBe('inactive');

    $this->actingAs($this->admin)->patch(route('technical-admin.services-assets.themes.status', $theme), ['active' => true]);
    expect($theme->fresh()->status)->toBe('active')
        ->and(DesignTheme::count())->toBe(8);
});

/* ---------------- Layout assets: one price each ---------------- */

test('an asset is added with its price and how it is counted', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.assets.store'), validAsset())
        ->assertRedirect(route('technical-admin.services-assets'))
        ->assertSessionHasNoErrors();

    $asset = LayoutAsset::where('asset_name', 'Ghost Chairs')->firstOrFail();

    expect($asset->asset_category)->toBe('Furniture')
        ->and($asset->price)->toBe('180.50')
        ->and($asset->pricing_type)->toBe('per_guest')
        ->and($asset->guests_per_unit)->toBe(1)
        ->and($asset->status)->toBe('active');
});

test('a fixed-price asset keeps no guests-per-unit', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.assets.store'), validAsset([
            'name' => 'Neon Sign', 'category' => 'Lighting', 'price' => '3000', 'pricingType' => 'fixed', 'guestsPerUnit' => 5,
        ]))
        ->assertSessionHasNoErrors();

    $asset = LayoutAsset::where('asset_name', 'Neon Sign')->firstOrFail();

    expect($asset->pricing_type)->toBe('fixed')
        ->and($asset->guests_per_unit)->toBeNull();
});

test('editing an asset changes its price and counting', function () {
    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.assets.update', chairs()), [
            'name' => 'Chiavari Chairs',
            'category' => 'Furniture',
            'price' => '55',
            'pricingType' => 'per_guest',
            'guestsPerUnit' => 1,
            'active' => true,
        ])
        ->assertSessionHasNoErrors();

    expect(chairs()->price)->toBe('55.00')
        ->and(LayoutAsset::count())->toBe(8);
});

test('incomplete or invalid assets are not saved', function (array $override, string $error) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.assets.store'), validAsset($override))
        ->assertSessionHasErrors($error);

    expect(LayoutAsset::count())->toBe(8);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'duplicate name, other case' => [['name' => 'chiavari chairs'], 'name'],
    'unknown category' => [['category' => 'Fireworks'], 'category'],
    'missing price' => [['price' => ''], 'price'],
    'zero price' => [['price' => '0'], 'price'],
    'three decimals' => [['price' => '10.505'], 'price'],
    'unknown counting' => [['pricingType' => 'hourly'], 'pricingType'],
    'per guest without guests per unit' => [['guestsPerUnit' => ''], 'guestsPerUnit'],
    'per guest with zero guests per unit' => [['guestsPerUnit' => 0], 'guestsPerUnit'],
]);

test('an asset can be switched off and on', function () {
    $this->actingAs($this->admin)->patch(route('technical-admin.services-assets.assets.status', chairs()), ['active' => false]);
    expect(chairs()->status)->toBe('inactive');

    $this->actingAs($this->admin)->patch(route('technical-admin.services-assets.assets.status', chairs()), ['active' => true]);
    expect(chairs()->status)->toBe('active')
        ->and(LayoutAsset::count())->toBe(8);
});