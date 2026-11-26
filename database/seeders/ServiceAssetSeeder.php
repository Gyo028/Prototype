<?php

namespace Database\Seeders;

use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Loads the sample services, event types, design themes and layout assets
 * that the Technical Admin's Services & Assets screens show today.
 *
 * Assets get sample prices, and each sample theme a default set (one asset
 * per slot), stored in its grid_config. The migration that introduced them
 * calls fillAssetPrices() and fillThemeDefaultSets() too, for a database
 * that was seeded before.
 */
class ServiceAssetSeeder extends Seeder
{
    /** Sample themes: [theme, event type, venue, style, max guests]. */
    public const THEMES = [
        ['Modern Lounge', 'Corporate', 'indoor', 'Modern', 150],
        ['Futuristic Gala', 'Corporate', 'indoor', 'Futuristic', 300],
        ['Garden Romance', 'Wedding', 'outdoor', 'Rustic', 250],
        ['Beach Bohemian', 'Wedding', 'outdoor', 'Bohemian', 150],
        ['Classic Ballroom', 'Wedding', 'indoor', 'Classic', 300],
        ['Party Corner', 'Birthday', 'indoor', 'Modern', 80],
        ['Rustic Garden Party', 'Birthday', 'outdoor', 'Rustic', 100],
        ['Debut Glam', 'Debut', 'indoor', 'Futuristic', 200],
    ];

    /** The Event Styling fee, added to every standard request. */
    public const STYLING_FEE = 10000;

    /**
     * Sample assets: [name, category, price, pricing type, guests per unit].
     * Per-guest assets count the guests ÷ guests per unit, rounded up.
     */
    public const ASSETS = [
        ['Chiavari Chairs', 'Furniture', 45, 'per_guest', 1],
        ['Cocktail Tables', 'Furniture', 350, 'per_guest', 10],
        ['Backdrop Panel', 'Structures', 8000, 'fixed', null],
        ['Entrance Arch', 'Structures', 6500, 'fixed', null],
        ['Balloon Clusters', 'Decors', 3500, 'fixed', null],
        ['Floral Centerpieces', 'Decors', 600, 'per_guest', 10],
        ['Fairy Lights', 'Lighting', 2500, 'fixed', null],
        ['Uplighting', 'Lighting', 4000, 'fixed', null],
    ];

    /** Every sample theme's default set: [slot key, label, category, default asset]. */
    public const DEFAULT_SLOTS = [
        ['backdrop', 'Backdrop', 'Structures', 'Backdrop Panel'],
        ['seating', 'Seating', 'Furniture', 'Chiavari Chairs'],
        ['tables', 'Tables', 'Furniture', 'Cocktail Tables'],
        ['lighting', 'Lighting', 'Lighting', 'Fairy Lights'],
    ];

    /** Extra slots for some event types: wedding tables get centerpieces. */
    public const EVENT_TYPE_SLOTS = [
        'Wedding' => [['centerpieces', 'Centerpieces', 'Decors', 'Floral Centerpieces']],
        'Birthday' => [['decor', 'Decor', 'Decors', 'Balloon Clusters']],
        'Debut' => [['decor', 'Decor', 'Decors', 'Balloon Clusters']],
    ];

    public function run(): void
    {
        $this->services();
        $this->eventTypes();
        $this->designThemes();
        $this->layoutAssets();

        self::fillAssetPrices();
        self::fillThemeDefaultSets();
    }

    /** Sample assets that have no price yet get their sample price. */
    public static function fillAssetPrices(): void
    {
        foreach (self::ASSETS as [$name, , $price, $pricing, $perUnit]) {
            DB::table('layout_assets')
                ->where('asset_name', $name)
                ->whereNull('price')
                ->update(['price' => $price, 'pricing_type' => $pricing, 'guests_per_unit' => $perUnit]);
        }
    }

    /**
     * Sample themes without a default set get one. A slot whose default asset
     * is missing is left out.
     */
    public static function fillThemeDefaultSets(): void
    {
        $assetIds = DB::table('layout_assets')->pluck('asset_id', 'asset_name');
        $eventTypes = DB::table('event_types')->pluck('event_type_name', 'event_type_id');
        $sampleThemes = array_column(self::THEMES, 0);

        $themes = DB::table('design_themes')
            ->whereIn('theme_name', $sampleThemes)
            ->whereNull('grid_config')
            ->get(['theme_id', 'event_type_id']);

        foreach ($themes as $theme) {
            $slots = [];

            foreach ([...self::DEFAULT_SLOTS, ...(self::EVENT_TYPE_SLOTS[$eventTypes[$theme->event_type_id] ?? ''] ?? [])] as [$key, $label, $category, $asset]) {
                if (isset($assetIds[$asset])) {
                    $slots[] = ['key' => $key, 'label' => $label, 'category' => $category, 'defaultAssetId' => (int) $assetIds[$asset]];
                }
            }

            DB::table('design_themes')
                ->where('theme_id', $theme->theme_id)
                ->update(['grid_config' => json_encode(['slots' => $slots])]);
        }
    }

    private function services(): void
    {
        if (Service::query()->exists()) {
            return;
        }

        // [name, category, description, pricing_type, unit_type, price]
        $services = [
            // The flat fee included with every Event Styling request (protected on the screen).
            ['Event Styling', 'Styling', 'Full event styling package. Automatically included with every Event Styling request.', 'fixed', null, self::STYLING_FEE],
            ['DJ Services', 'Entertainment', 'Professional DJ and sound system for the event.', 'fixed', null, 15000],
            ['Photobooth Rental', 'Entertainment', 'On-site photobooth with props and instant prints.', 'fixed', null, 8000],
            ['Photography Package', 'Photo & Video', 'Event-day photography coverage.', 'fixed', null, 20000],
            ['Videography Package', 'Photo & Video', 'Event-day videography coverage with edited highlights.', 'fixed', null, 25000],
            ['Buffet Catering', 'Catering', 'Full buffet catering, priced per guest.', 'per_unit', 'pax', 650],
            ['Host / Emcee Services', 'Host', 'Professional host or emcee for the event program.', 'fixed', null, 5000],
        ];

        foreach ($services as [$name, $category, $description, $pricing, $unit, $price]) {
            Service::create([
                'service_name' => $name,
                'service_category' => $category,
                'description' => $description,
                'pricing_type' => $pricing,
                'unit_type' => $unit,
                'price' => $price,
            ]);
        }
    }

    private function eventTypes(): void
    {
        if (EventType::query()->exists()) {
            return;
        }

        foreach (['Corporate', 'Wedding', 'Birthday', 'Debut'] as $name) {
            EventType::create(['event_type_name' => $name]);
        }
    }

    private function designThemes(): void
    {
        if (DesignTheme::query()->exists()) {
            return;
        }

        $eventTypes = EventType::query()->pluck('event_type_id', 'event_type_name');

        foreach (self::THEMES as [$name, $eventType, $venue, $style, $maxGuests]) {
            // Skip a theme whose event type was renamed or removed by the admin.
            if (! isset($eventTypes[$eventType])) {
                continue;
            }

            DesignTheme::create([
                'theme_name' => $name,
                'event_type_id' => $eventTypes[$eventType],
                'venue' => $venue,
                'style' => $style,
                'max_guests' => $maxGuests,
            ]);
        }
    }

    private function layoutAssets(): void
    {
        if (LayoutAsset::query()->exists()) {
            return;
        }

        foreach (self::ASSETS as [$name, $category, $price, $pricing, $perUnit]) {
            LayoutAsset::create([
                'asset_name' => $name,
                'asset_category' => $category,
                'price' => $price,
                'pricing_type' => $pricing,
                'guests_per_unit' => $perUnit,
            ]);
        }
    }
}