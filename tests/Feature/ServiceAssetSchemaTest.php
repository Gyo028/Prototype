<?php

use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

function makeTheme(array $overrides = []): DesignTheme
{
    $eventType = EventType::firstOrCreate(['event_type_name' => 'Wedding']);

    return DesignTheme::create(array_merge([
        'theme_name' => 'Garden Romance',
        'event_type_id' => $eventType->event_type_id,
        'max_guests' => 250,
        'venue' => 'outdoor',
        'style' => 'Rustic',
    ], $overrides));
}

test('the tables follow the ERD column names, plus services.price', function () {
    expect(Schema::getColumnListing('services'))->toEqualCanonicalizing([
        'service_id', 'service_name', 'service_category', 'description', 'pricing_type', 'unit_type', 'price', 'status',
    ]);
    expect(Schema::getColumnListing('event_types'))->toEqualCanonicalizing([
        'event_type_id', 'event_type_name', 'description', 'status',
    ]);
    expect(Schema::getColumnListing('design_themes'))->toEqualCanonicalizing([
        'theme_id', 'theme_name', 'description', 'event_type_id', 'min_guests', 'max_guests', 'venue', 'style',
        'background_image_path', 'grid_config', 'status', 'created_at', 'updated_at',
    ]);
    // asset_variants was dropped: an asset has one price (GR3AT A has no size or price tiers).
    expect(Schema::getColumnListing('layout_assets'))->toEqualCanonicalizing([
        'asset_id', 'asset_name', 'asset_category', 'description', 'isometric_icon_path', 'placement_zone',
        'price', 'pricing_type', 'guests_per_unit', 'status',
    ]);
    expect(Schema::hasTable('asset_variants'))->toBeFalse();
});

test('a service is saved with its price and defaults to fixed and active', function () {
    $service = Service::create(['service_name' => 'DJ Services', 'service_category' => 'Entertainment', 'price' => 15000]);
    $catering = Service::create([
        'service_name' => 'Buffet Catering', 'service_category' => 'Catering',
        'pricing_type' => 'per_unit', 'unit_type' => 'pax', 'price' => 650.5,
    ]);

    $service->refresh();

    expect($service->pricing_type)->toBe(Service::PRICING_FIXED)
        ->and($service->status)->toBe(Service::STATUS_ACTIVE)
        ->and($service->price)->toBe('15000.00')
        ->and($catering->fresh()->price)->toBe('650.50');
});

test('names are unique', function (Closure $create) {
    $create();
    $create();
})->throws(QueryException::class)->with([
    'service' => fn () => Service::create(['service_name' => 'DJ Services', 'service_category' => 'Entertainment', 'price' => 1]),
    'event type' => fn () => EventType::create(['event_type_name' => 'Wedding']),
    'theme' => fn () => makeTheme(),
    'asset' => fn () => LayoutAsset::create(['asset_name' => 'Chiavari Chairs', 'asset_category' => 'Furniture']),
]);

test('a theme belongs to an event type, keeps its grid config and has optional fields', function () {
    $theme = makeTheme(['grid_config' => ['columns' => 12, 'rows' => 8]]);

    $theme->refresh();

    expect($theme->eventType->event_type_name)->toBe('Wedding')
        ->and($theme->grid_config)->toBe(['columns' => 12, 'rows' => 8])
        ->and($theme->min_guests)->toBeNull()
        ->and($theme->background_image_path)->toBeNull()
        ->and($theme->status)->toBe('active')
        ->and($theme->created_at)->not->toBeNull();
});

test('an event type that themes use cannot be deleted', function () {
    $theme = makeTheme();

    $theme->eventType->delete();
})->throws(QueryException::class);

test('only the venues and placement zones in the ERD are accepted', function (Closure $create) {
    $create();
})->throws(QueryException::class)->with([
    'venue' => fn () => makeTheme(['venue' => 'rooftop']),
    'placement zone' => fn () => LayoutAsset::create(['asset_name' => 'Arch', 'asset_category' => 'Structures', 'placement_zone' => 'roof']),
    'pricing type' => fn () => Service::create(['service_name' => 'X', 'service_category' => 'Host', 'price' => 1, 'pricing_type' => 'hourly']),
]);

test('an asset has one price, fixed by default; per-guest assets count from the guest count', function () {
    $arch = LayoutAsset::create(['asset_name' => 'Entrance Arch', 'asset_category' => 'Structures', 'price' => 6500]);
    $chairs = LayoutAsset::create(['asset_name' => 'Chiavari Chairs', 'asset_category' => 'Furniture', 'price' => 45, 'pricing_type' => 'per_guest', 'guests_per_unit' => 1]);
    $tables = LayoutAsset::create(['asset_name' => 'Cocktail Tables', 'asset_category' => 'Furniture', 'price' => 350, 'pricing_type' => 'per_guest', 'guests_per_unit' => 10]);
    $unpriced = LayoutAsset::create(['asset_name' => 'Uplighting', 'asset_category' => 'Lighting']);

    expect($arch->fresh()->pricing_type)->toBe('fixed')
        ->and($arch->fresh()->price)->toBe('6500.00')
        ->and($arch->quantityFor(150))->toBe(1)
        ->and($chairs->quantityFor(150))->toBe(150)
        ->and($tables->quantityFor(150))->toBe(15)
        ->and($tables->quantityFor(151))->toBe(16) // rounded up
        ->and($unpriced->fresh()->price)->toBeNull()
        // Customers are offered switched-on, priced assets only.
        ->and(LayoutAsset::query()->offered()->pluck('asset_name')->all())->toEqualCanonicalizing(['Entrance Arch', 'Chiavari Chairs', 'Cocktail Tables']);
});

test('only fixed and per-guest asset pricing is accepted', function () {
    LayoutAsset::create(['asset_name' => 'Arch', 'asset_category' => 'Structures', 'price' => 1, 'pricing_type' => 'hourly']);
})->throws(QueryException::class);

test('a theme reads its default set from grid_config', function () {
    $theme = makeTheme(['grid_config' => ['slots' => [
        ['key' => 'backdrop', 'label' => 'Backdrop', 'category' => 'Structures', 'defaultAssetId' => 3],
        ['key' => 'broken'], // no category: ignored
    ]]]);

    expect($theme->fresh()->slots())->toBe([
        ['key' => 'backdrop', 'label' => 'Backdrop', 'category' => 'Structures', 'defaultAssetId' => 3],
    ])
        ->and(makeTheme(['theme_name' => 'Plain'])->slots())->toBe([]);
});
