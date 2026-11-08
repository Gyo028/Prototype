<?php

use App\Models\AssetVariant;
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
    expect(Schema::getColumnListing('layout_assets'))->toEqualCanonicalizing([
        'asset_id', 'asset_name', 'asset_category', 'description', 'isometric_icon_path', 'placement_zone', 'status',
    ]);
    expect(Schema::getColumnListing('asset_variants'))->toEqualCanonicalizing([
        'asset_variant_id', 'asset_id', 'variant_name', 'description', 'price', 'status',
    ]);
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

test('assets have priced variants, with variant names unique per asset only', function () {
    $chairs = LayoutAsset::create(['asset_name' => 'Chiavari Chairs', 'asset_category' => 'Furniture', 'placement_zone' => 'floor']);
    $tables = LayoutAsset::create(['asset_name' => 'Cocktail Tables', 'asset_category' => 'Furniture']);

    $chairs->variants()->create(['variant_name' => 'Gold', 'price' => 150]);
    $tables->variants()->create(['variant_name' => 'Gold', 'price' => 300]); // same name, different asset: fine

    expect($chairs->variants()->first()->price)->toBe('150.00')
        ->and($tables->fresh()->placement_zone)->toBeNull()
        ->and(AssetVariant::count())->toBe(2);

    $chairs->variants()->create(['variant_name' => 'Gold', 'price' => 175]);
})->throws(QueryException::class);

test('an asset with variants cannot be deleted', function () {
    $chairs = LayoutAsset::create(['asset_name' => 'Chiavari Chairs', 'asset_category' => 'Furniture']);
    $chairs->variants()->create(['variant_name' => 'Gold', 'price' => 150]);

    $chairs->delete();
})->throws(QueryException::class);