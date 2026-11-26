<?php

use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use Database\Seeders\ServiceAssetSeeder;

test('the seeder loads the sample services, event types, themes and assets', function () {
    $this->seed(ServiceAssetSeeder::class);

    expect(Service::count())->toBe(7)
        ->and(EventType::count())->toBe(4)
        ->and(DesignTheme::count())->toBe(8)
        ->and(LayoutAsset::count())->toBe(8)
        ->and(LayoutAsset::whereNull('price')->count())->toBe(0) // every sample asset is priced
        ->and(EventType::where('event_type_name', 'Mall Activation')->exists())->toBeFalse();
});

test('the Event Styling fee and the per-guest catering are seeded correctly', function () {
    $this->seed(ServiceAssetSeeder::class);

    $styling = Service::where('service_name', 'Event Styling')->firstOrFail();
    $catering = Service::where('service_name', 'Buffet Catering')->firstOrFail();

    expect($styling->service_category)->toBe('Styling')
        ->and($styling->price)->toBe('10000.00')
        ->and($catering->pricing_type)->toBe('per_unit')
        ->and($catering->unit_type)->toBe('pax')
        ->and($catering->price)->toBe('650.00');
});

test('themes are linked to their event types', function () {
    $this->seed(ServiceAssetSeeder::class);

    $glam = DesignTheme::where('theme_name', 'Debut Glam')->firstOrFail();

    expect($glam->eventType->event_type_name)->toBe('Debut')
        ->and($glam->venue)->toBe('indoor')
        ->and($glam->max_guests)->toBe(200)
        ->and(EventType::where('event_type_name', 'Wedding')->first()->designThemes)->toHaveCount(3);
});

test('chairs and tables are counted from the guest count, the rest once', function () {
    $this->seed(ServiceAssetSeeder::class);

    $chairs = LayoutAsset::where('asset_name', 'Chiavari Chairs')->firstOrFail();
    $tables = LayoutAsset::where('asset_name', 'Cocktail Tables')->firstOrFail();
    $arch = LayoutAsset::where('asset_name', 'Entrance Arch')->firstOrFail();

    expect($chairs->pricing_type)->toBe('per_guest')
        ->and($chairs->guests_per_unit)->toBe(1)
        ->and($tables->guests_per_unit)->toBe(10)
        ->and($arch->pricing_type)->toBe('fixed')
        ->and($arch->guests_per_unit)->toBeNull();
});

test('every sample theme gets a default set of existing assets, one per slot', function () {
    $this->seed(ServiceAssetSeeder::class);

    $assetIds = LayoutAsset::pluck('asset_id')->all();

    foreach (DesignTheme::all() as $theme) {
        $slots = $theme->slots();

        expect($slots)->not->toBeEmpty();

        foreach ($slots as $slot) {
            expect($assetIds)->toContain($slot['defaultAssetId'])
                ->and(LayoutAsset::find($slot['defaultAssetId'])->asset_category)->toBe($slot['category']);
        }
    }

    $wedding = DesignTheme::where('theme_name', 'Garden Romance')->firstOrFail();

    expect(array_column($wedding->slots(), 'key'))->toBe(['backdrop', 'seating', 'tables', 'lighting', 'centerpieces']);
});

test('running the seeder again changes nothing, so admin edits are never overwritten', function () {
    $this->seed(ServiceAssetSeeder::class);

    Service::where('service_name', 'DJ Services')->update(['price' => 18000]);

    $this->seed(ServiceAssetSeeder::class);

    expect(Service::count())->toBe(7)
        ->and(DesignTheme::count())->toBe(8)
        ->and(Service::where('service_name', 'DJ Services')->first()->price)->toBe('18000.00');
});

test('asset prices and default sets are only filled in where missing', function () {
    $this->seed(ServiceAssetSeeder::class);

    LayoutAsset::where('asset_name', 'Entrance Arch')->update(['price' => 7000]);
    DesignTheme::where('theme_name', 'Party Corner')->update(['grid_config' => json_encode(['slots' => []])]);

    ServiceAssetSeeder::fillAssetPrices();
    ServiceAssetSeeder::fillThemeDefaultSets();

    expect(LayoutAsset::where('asset_name', 'Entrance Arch')->first()->price)->toBe('7000.00')
        ->and(DesignTheme::where('theme_name', 'Party Corner')->first()->slots())->toBe([]);
});