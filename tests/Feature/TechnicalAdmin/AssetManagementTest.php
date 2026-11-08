<?php

use App\Enums\Role;
use App\Models\AssetVariant;
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
        'active' => true,
        'variants' => [
            ['id' => null, 'name' => 'Clear', 'description' => 'Acrylic', 'price' => '180', 'active' => true],
            ['id' => null, 'name' => 'Smoke', 'description' => '', 'price' => '200.50', 'active' => true],
        ],
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

test('the screen sends themes, event types, styles, assets and their variants', function () {
    chairs()->variants()->create(['variant_name' => 'Gold', 'price' => 150]);

    $this->actingAs($this->admin)
        ->get(route('technical-admin.services-assets'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('themes', 9)
            ->has('eventTypes', 5)
            ->where('styles', DesignTheme::STYLES)
            ->has('assets', 8)
            ->where('assetCategories', LayoutAsset::CATEGORIES)
            ->where('assets.0.name', 'Chiavari Chairs')
            ->has('assets.0.variants', 1)
            ->where('assets.0.variants.0.name', 'Gold')
            ->has('assets.1.variants', 0)
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

    expect(DesignTheme::count())->toBe(9);
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
        ->and(DesignTheme::count())->toBe(9);
});

/* ---------------- Layout assets and variants ---------------- */

test('an asset is added together with its priced variants', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.assets.store'), validAsset())
        ->assertRedirect(route('technical-admin.services-assets'))
        ->assertSessionHasNoErrors();

    $asset = LayoutAsset::where('asset_name', 'Ghost Chairs')->firstOrFail();
    $variants = $asset->variants()->orderBy('asset_variant_id')->get();

    expect($asset->asset_category)->toBe('Furniture')
        ->and($variants)->toHaveCount(2)
        ->and($variants[0]->variant_name)->toBe('Clear')
        ->and($variants[0]->description)->toBe('Acrylic')
        ->and($variants[0]->price)->toBe('180.00')
        ->and($variants[1]->description)->toBeNull()
        ->and($variants[1]->price)->toBe('200.50');
});

test('an asset can be saved without variants', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.assets.store'), validAsset(['variants' => []]))
        ->assertSessionHasNoErrors();

    expect(LayoutAsset::where('asset_name', 'Ghost Chairs')->first()->variants)->toHaveCount(0);
});

test('editing an asset updates existing variants, adds new ones and never deletes', function () {
    $gold = chairs()->variants()->create(['variant_name' => 'Gold', 'price' => 150]);
    $silver = chairs()->variants()->create(['variant_name' => 'Silver', 'price' => 140]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.assets.update', chairs()), [
            'name' => 'Chiavari Chairs',
            'category' => 'Furniture',
            'active' => true,
            'variants' => [
                ['id' => $gold->asset_variant_id, 'name' => 'Gold', 'description' => '', 'price' => '165', 'active' => true],
                ['id' => $silver->asset_variant_id, 'name' => 'Silver', 'description' => '', 'price' => '140', 'active' => false],
                ['id' => null, 'name' => 'White', 'description' => '', 'price' => '150', 'active' => true],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect($gold->fresh()->price)->toBe('165.00')
        ->and($silver->fresh()->status)->toBe('inactive')
        ->and(chairs()->variants()->count())->toBe(3);
});

test('incomplete or invalid assets are not saved', function (array $override, string $error) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.assets.store'), validAsset($override))
        ->assertSessionHasErrors($error);

    expect(LayoutAsset::count())->toBe(8)
        ->and(AssetVariant::count())->toBe(0);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'duplicate name, other case' => [['name' => 'chiavari chairs'], 'name'],
    'unknown category' => [['category' => 'Fireworks'], 'category'],
    'variant without name' => [['variants' => [['id' => null, 'name' => '', 'price' => '100']]], 'variants.0.name'],
    'variant without price' => [['variants' => [['id' => null, 'name' => 'Gold', 'price' => '']]], 'variants.0.price'],
    'variant with zero price' => [['variants' => [['id' => null, 'name' => 'Gold', 'price' => '0']]], 'variants.0.price'],
    'two variants, same name' => [['variants' => [
        ['id' => null, 'name' => 'Gold', 'price' => '100'],
        ['id' => null, 'name' => 'gold', 'price' => '120'],
    ]], 'variants.1.name'],
]);

test('a variant of another asset cannot be changed through this asset', function () {
    $tables = LayoutAsset::where('asset_name', 'Cocktail Tables')->firstOrFail();
    $tableVariant = $tables->variants()->create(['variant_name' => 'Round', 'price' => 300]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.assets.update', chairs()), [
            'name' => 'Chiavari Chairs',
            'category' => 'Furniture',
            'variants' => [['id' => $tableVariant->asset_variant_id, 'name' => 'Hacked', 'price' => '1']],
        ])
        ->assertSessionHasErrors('variants.0.id');

    expect($tableVariant->fresh()->variant_name)->toBe('Round');
});

test('a new variant cannot reuse the name of a saved one left out of the form', function () {
    chairs()->variants()->create(['variant_name' => 'Gold', 'price' => 150]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.assets.update', chairs()), [
            'name' => 'Chiavari Chairs',
            'category' => 'Furniture',
            'variants' => [['id' => null, 'name' => 'GOLD', 'price' => '160']],
        ])
        ->assertSessionHasErrors('variants');

    expect(chairs()->variants()->count())->toBe(1);
});

test('an asset can be switched off and on', function () {
    $this->actingAs($this->admin)->patch(route('technical-admin.services-assets.assets.status', chairs()), ['active' => false]);
    expect(chairs()->status)->toBe('inactive');

    $this->actingAs($this->admin)->patch(route('technical-admin.services-assets.assets.status', chairs()), ['active' => true]);
    expect(chairs()->status)->toBe('active')
        ->and(LayoutAsset::count())->toBe(8);
});