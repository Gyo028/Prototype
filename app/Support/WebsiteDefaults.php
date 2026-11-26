<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The landing page's photo slots, service pages and Our Works photo library,
 * plus the content that the hard-coded public pages show today.
 *
 * Used by the WebsiteContentSeeder (fresh database) and by the migration that
 * adds the photo library (database that was seeded earlier), so both end up
 * with the same rows. Every method only adds what is missing and never touches
 * something the Technical Admin already changed.
 *
 * Seeded photos point to files in public/images (shipped with the app), so
 * their file_path starts with "/". Photos the admin uploads are stored on the
 * website disk and their file_path has no leading "/".
 */
class WebsiteDefaults
{
    /** Our Works photo categories, matching the three service pages. */
    public const CATEGORIES = [
        'corporate_events' => 'Corporate Events',
        'special_occasions' => 'Special Occasions',
        'custom_projects' => 'Custom Projects',
    ];

    /** The three service detail pages: block_key => category. */
    public const SERVICE_PAGES = [
        'svc_corporate' => 'corporate_events',
        'svc_special' => 'special_occasions',
        'svc_custom' => 'custom_projects',
    ];

    /**
     * The fixed photo slots of each block and the kind of photo each takes:
     * "banner" = wide hero photo, "photo" = any other photo.
     */
    public const SLOTS = [
        'hero' => ['hero' => 'banner'],
        'about' => ['about_1' => 'photo', 'about_2' => 'photo', 'about_3' => 'photo'],
        'svc_corporate' => ['hero' => 'banner', 'intro_1' => 'photo', 'intro_2' => 'photo'],
        'svc_special' => ['hero' => 'banner', 'intro_1' => 'photo', 'intro_2' => 'photo'],
        'svc_custom' => ['hero' => 'banner', 'intro_1' => 'photo', 'intro_2' => 'photo'],
    ];

    /** Public address of each service page. */
    public const SERVICE_PAGE_URLS = [
        'svc_corporate' => '/services/corporate-events',
        'svc_special' => '/services/special-occasions',
        'svc_custom' => '/services/custom-fabrication',
    ];

    /**
     * The photo each service page shows of itself on the other pages' "More
     * services" cards (as the pages looked when they were hard-coded).
     */
    public const MORE_SERVICES_PHOTO = [
        'svc_corporate' => 'intro_2',
        'svc_special' => 'intro_1',
        'svc_custom' => 'intro_1',
    ];

    /** Contact & Footer details, used until the Technical Admin saves them. */
    public const CONTACT = [
        'name' => "GR3AT A's Event Styling Services",
        'phone' => '09175352156',
        'email' => 'gr3ataseventsstyling@gmail.com',
        'address' => 'Altezza, Deparo, Caloocan City, Philippines',
        'facebook' => 'https://www.facebook.com/share/17uj5e738o/',
        'instagram' => '',
        'copyright' => "Copyright © 2026 GR3AT A's Event Styling Services. All rights reserved.",
    ];

    /** Photos shown on the homepage carousel at most. */
    public const CAROUSEL_MAX = 10;

    /** Photos in each service page showcase (the grid needs exactly this many). */
    public const SHOWCASE_SIZE = 4;

    /** The About Us text the landing page shows today (two paragraphs). */
    public const ABOUT = [
        "GR3AT A's Event Styling & Services specializes in customized event setups and styling tailored to each client's needs and vision.",
        "From Event decorations and furniture to custom structures, signage, printing, and greenery, we provide a wide range of products and services to bring every concept to life. More than just a business, GR3AT A's is a company with a heart. We are committed to supporting the education of our scholars and extending help to selected charitable institutions.",
    ];

    /** The service card titles. Fixed: they match the three service pages. */
    public const CARD_TITLES = ['Corporate Events', 'Special Occasions', 'Custom Projects'];

    /** Seeded slot photos: block_key => [slot => [file, alt text]]. Also the fallback when a slot is empty. */
    public const SLOT_PHOTOS = [
        'hero' => ['hero' => ['/images/hero-bg.webp', 'Balloon arch and floral backdrop styled by GR3AT A\'s']],
        'about' => [
            'about_1' => ['/images/works/work-8.webp', 'Green hedge wall with illuminated signage'],
            'about_2' => ['/images/works/work-1.webp', 'Light and greenery display'],
            'about_3' => ['/images/works/work-17.webp', 'Carnival tent and brand booth setup'],
        ],
        'svc_corporate' => [
            'hero' => ['/images/works/work-20.webp', 'Grand arch entrance for a corporate night'],
            'intro_1' => ['/images/works/work-4.webp', 'Corporate launch stage styling'],
            'intro_2' => ['/images/works/work-3.webp', 'Brand booth setup'],
        ],
        'svc_special' => [
            'hero' => ['/images/hero-bg5.webp', 'Balloon and floral backdrop with a white armchair'],
            'intro_1' => ['/images/works/work-7.webp', 'A Paris-themed celebration'],
            'intro_2' => ['/images/works/work-19.webp', 'Giant paper flowers'],
        ],
        'svc_custom' => [
            'hero' => ['/images/works/work-5.webp', 'Custom themed hall backdrop'],
            'intro_1' => ['/images/works/work-8.webp', 'Garden signage'],
            'intro_2' => ['/images/works/work-16.webp', 'Mirror tunnel installation'],
        ],
    ];

    /**
     * The Our Works photo library:
     * [work number, title, caption, category, carousel order, showcase order].
     * Carousel order follows the landing page carousel today.
     */
    private const LIBRARY = [
        [14, 'Wellness Place', 'Mall activation', 'custom_projects', 1, 3],
        [13, 'SM City Fairview Plant Wall', 'Mall greening project', 'custom_projects', 2, null],
        [18, 'Holiday Installation', 'Christmas mall display', 'custom_projects', 3, 2],
        [3, 'Digiplus Booth', 'Brand booth', 'corporate_events', 4, null],
        [15, 'Garden Arch Aisle', 'Wedding and reception styling', 'special_occasions', 5, 1],
        [10, 'Paris-Themed Setup', 'Themed celebration', 'special_occasions', 6, 2],
        [16, 'Mirror Tunnel Installation', 'Custom installation', 'custom_projects', 7, null],
        [17, 'Interactive Brand Booth', 'Brand activation', 'corporate_events', 8, 3],
        [19, 'Giant Paper Flowers', 'Mall activation', 'custom_projects', 9, null],
        [11, 'Aura Floral Installation', 'Giant floral fabrication', 'custom_projects', 10, 1],
        [20, 'The Grand Entrance', 'Gala and dinner styling', 'corporate_events', null, 1],
        [12, 'Sponsor Media Wall', 'Step-and-repeat backdrop', 'corporate_events', null, 2],
        [4, 'Corporate Launch', 'Product launch', 'corporate_events', null, 4],
        [2, 'Gala Night', 'Corporate gala', 'corporate_events', null, null],
        [6, 'Golden Moments', 'Wedding styling', 'special_occasions', null, 3],
        [7, 'A Night in Paris', 'Themed event', 'special_occasions', null, 4],
        [9, 'Hanging Gardens', 'Greenery styling', 'special_occasions', null, null],
        [1, 'Light and Greenery Display', 'Themed installation', 'custom_projects', null, 4],
        [5, 'Themed Hall Backdrop', 'Themed backdrop', 'custom_projects', null, null],
        [8, 'Garden Signage', 'Lighted signage', 'custom_projects', null, null],
    ];

    /** Adds the blocks, slot photos and photo library that are still missing. */
    public static function applyPhotos(): void
    {
        $now = Carbon::now();

        $ids = [
            'hero' => self::ensureBlock('hero', 'homepage', 'Hero Section', 1),
            'about' => self::ensureBlock('about', 'homepage', 'About Us', 2, implode("\n\n", self::ABOUT)),
            'works' => self::ensureBlock('works', 'gallery', 'Our Works', 1),
            'svc_corporate' => self::ensureBlock('svc_corporate', 'services', 'Corporate Events Page', 11),
            'svc_special' => self::ensureBlock('svc_special', 'services', 'Special Occasions Page', 12),
            'svc_custom' => self::ensureBlock('svc_custom', 'services', 'Custom Projects Page', 13),
        ];

        foreach (self::SLOT_PHOTOS as $block => $slots) {
            foreach ($slots as $slot => [$path, $alt]) {
                $exists = DB::table('website_content_images')
                    ->where('content_id', $ids[$block])
                    ->where('slot', $slot)
                    ->exists();

                if (! $exists) {
                    DB::table('website_content_images')->insert([
                        'content_id' => $ids[$block],
                        'slot' => $slot,
                        'file_path' => $path,
                        'alt_text' => $alt,
                        'sort_order' => 0,
                        'status' => 'active',
                        'updated_at' => $now,
                    ]);
                }
            }
        }

        // The library is seeded once. Photos added before the library existed
        // (the old placeholder carousel: app files without a title) are replaced.
        $hasLibrary = DB::table('website_content_images')
            ->where('content_id', $ids['works'])
            ->whereNotNull('title')
            ->exists();

        if ($hasLibrary) {
            return;
        }

        DB::table('website_content_images')
            ->where('content_id', $ids['works'])
            ->whereNull('title')
            ->where('file_path', 'like', '/images/%')
            ->delete();

        foreach (self::LIBRARY as $i => [$number, $title, $caption, $category, $carousel, $showcase]) {
            DB::table('website_content_images')->insert([
                'content_id' => $ids['works'],
                'file_path' => "/images/works/work-{$number}.webp",
                'title' => $title,
                'caption' => $caption,
                'category' => $category,
                'alt_text' => $title,
                'homepage_order' => $carousel,
                'showcase_order' => $showcase,
                'sort_order' => $i + 1,
                'status' => 'active',
                'updated_at' => $now,
            ]);
        }
    }

    /** Returns the block's content_id, creating the block if it is missing. */
    private static function ensureBlock(string $key, string $section, string $title, int $order, ?string $content = null): int
    {
        $id = DB::table('website_contents')->where('block_key', $key)->value('content_id');

        if ($id !== null) {
            return (int) $id;
        }

        return (int) DB::table('website_contents')->insertGetId([
            'section' => $section,
            'block_key' => $key,
            'title' => $title,
            'content' => $content,
            'sort_order' => $order,
            'updated_at' => Carbon::now(),
        ], 'content_id');
    }
}
