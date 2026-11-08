<?php

use App\Models\AssetVariant;
use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use Database\Seeders\ServiceAssetSeeder;

test('the seeder loads the sample services, event types, themes and assets', function () {
    $this->seed(ServiceAssetSeeder::class);

    expect(Service::count())->toBe(7)
        ->and(EventType::count())->toBe(5)
        ->and(DesignTheme::count())->toBe(9)
        ->and(LayoutAsset::count())->toBe(8)
        ->and(AssetVariant::count())->toBe(0); // real prices are added later
});

test('the Event Styling fee and the per-guest catering are seeded correctly', function () {
    $this->seed(ServiceAssetSeeder::class);

    $styling = Service::where('service_name', 'Event Styling')->firstOrFail();
    $catering = Service::where('service_name', 'Buffet Catering')->firstOrFail();

    expect($styling->service_category)->toBe('Styling')
        ->and($styling->price)->toBe('45000.00')
        ->and($catering->pricing_type)->toBe('per_unit')
        ->and($catering->unit_type)->toBe('pax')
        ->and($catering->price)->toBe('650.00');
});

test('themes are linked to their event types', function () {
    $this->seed(ServiceAssetSeeder::class);

    $booth = DesignTheme::where('theme_name', 'Mall Display Booth')->firstOrFail();

    expect($booth->eventType->event_type_name)->toBe('Mall Activation')
        ->and($booth->venue)->toBe('indoor')
        ->and($booth->max_guests)->toBe(1000)
        ->and(EventType::where('event_type_name', 'Wedding')->first()->designThemes)->toHaveCount(3);
});

test('running the seeder again changes nothing, so admin edits are never overwritten', function () {
    $this->seed(ServiceAssetSeeder::class);

    Service::where('service_name', 'DJ Services')->update(['price' => 18000]);

    $this->seed(ServiceAssetSeeder::class);

    expect(Service::count())->toBe(7)
        ->and(DesignTheme::count())->toBe(9)
        ->and(Service::where('service_name', 'DJ Services')->first()->price)->toBe('18000.00');
});