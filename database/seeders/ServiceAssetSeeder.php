<?php

namespace Database\Seeders;

use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use Illuminate\Database\Seeder;

/**
 * Loads the sample services, event types, design themes and layout assets
 * that the Technical Admin's Services & Assets screens show today.
 *
 * Assets get no variants yet: real prices are added later from the screen.
 */
class ServiceAssetSeeder extends Seeder
{
    public function run(): void
    {
        $this->services();
        $this->eventTypes();
        $this->designThemes();
        $this->layoutAssets();
    }

    private function services(): void
    {
        if (Service::query()->exists()) {
            return;
        }

        // [name, category, description, pricing_type, unit_type, price]
        $services = [
            // The flat fee included with every Event Styling request (protected on the screen).
            ['Event Styling', 'Styling', 'Full event styling package. Automatically included with every Event Styling request.', 'fixed', null, 45000],
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

        foreach (['Corporate', 'Wedding', 'Birthday', 'Debut', 'Mall Activation'] as $name) {
            EventType::create(['event_type_name' => $name]);
        }
    }

    private function designThemes(): void
    {
        if (DesignTheme::query()->exists()) {
            return;
        }

        $eventTypes = EventType::query()->pluck('event_type_id', 'event_type_name');

        // [theme, event type, venue, style, max guests]
        $themes = [
            ['Modern Lounge', 'Corporate', 'indoor', 'Modern', 150],
            ['Futuristic Gala', 'Corporate', 'indoor', 'Futuristic', 300],
            ['Garden Romance', 'Wedding', 'outdoor', 'Rustic', 250],
            ['Beach Bohemian', 'Wedding', 'outdoor', 'Bohemian', 150],
            ['Classic Ballroom', 'Wedding', 'indoor', 'Classic', 300],
            ['Party Corner', 'Birthday', 'indoor', 'Modern', 80],
            ['Rustic Garden Party', 'Birthday', 'outdoor', 'Rustic', 100],
            ['Debut Glam', 'Debut', 'indoor', 'Futuristic', 200],
            ['Mall Display Booth', 'Mall Activation', 'indoor', 'Modern', 1000],
        ];

        foreach ($themes as [$name, $eventType, $venue, $style, $maxGuests]) {
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

        $assets = [
            ['Chiavari Chairs', 'Furniture'],
            ['Cocktail Tables', 'Furniture'],
            ['Backdrop Panel', 'Structures'],
            ['Entrance Arch', 'Structures'],
            ['Balloon Clusters', 'Decors'],
            ['Floral Centerpieces', 'Decors'],
            ['Fairy Lights', 'Lighting'],
            ['Uplighting', 'Lighting'],
        ];

        foreach ($assets as [$name, $category]) {
            LayoutAsset::create(['asset_name' => $name, 'asset_category' => $category]);
        }
    }
}