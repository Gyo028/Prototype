<?php

use App\Support\WebsiteDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Website Content: photo slots, service pages and the Our Works photo library.
 *
 * New columns on website_content_images:
 *  - slot: which fixed photo of a block this is (hero, about_1..3, intro_1/2).
 *    Empty for Our Works photos.
 *  - thumb_path: small copy for the admin list (uploaded photos only).
 *  - title, caption, category: Our Works photo details.
 *  - homepage_order: 1-10 when the photo is on the homepage carousel.
 *  - showcase_order: 1-4 when the photo is in its category's service page
 *    showcase. A photo has one category, so it can only be in that page's showcase.
 *
 * The three service pages are website_contents rows in the existing
 * "services" section (block_key svc_corporate / svc_special / svc_custom),
 * so the section list stays as in the ERD.
 *
 * On a database that was seeded earlier, the rows are brought in line with
 * the landing page (only where the admin has not changed them yet). A fresh
 * database is filled by the WebsiteContentSeeder instead.
 */
return new class extends Migration
{
    /** The About Us text the first seeder wrote. Replaced only if still unchanged. */
    private const OLD_ABOUT = "Gr3at A's Events Styling & Services - specializes in event set-up and styling. We customize according to the needs of our clients. We supply rattan lamps, synthetic rattan furniture, drum furniture, upholstery, gigantic fabric and foam flowers, sticker decals, lighted signage, sublimation, tarp and sticker prints. We manufacture wood and steel structures with installation. We also supply plants for your greening projects.\n\nGr3at A's is a company with a heart. We are committed to supporting the education of our scholars and selected charitable institutions.\n\nWith Gr3at A's, graces are shared. Happy to serve!";

    public function up(): void
    {
        Schema::table('website_content_images', function (Blueprint $table) {
            $table->string('slot', 20)->nullable()->after('content_id');
            $table->string('thumb_path', 500)->nullable()->after('file_path');
            $table->string('title', 30)->nullable();
            $table->string('caption', 32)->nullable();
            $table->enum('category', array_keys(WebsiteDefaults::CATEGORIES))->nullable();
            $table->unsignedTinyInteger('homepage_order')->nullable();
            $table->unsignedTinyInteger('showcase_order')->nullable();

            $table->index(['content_id', 'slot']);
        });

        if (! DB::table('website_contents')->exists()) {
            return; // fresh database: the seeder fills it
        }

        // The hero text is now fixed in the page, so the hero row keeps only its photo.
        DB::table('website_contents')->where('block_key', 'hero')->update(['content' => null]);

        DB::table('website_contents')
            ->where('block_key', 'about')
            ->where('content', self::OLD_ABOUT)
            ->update(['content' => implode("\n\n", WebsiteDefaults::ABOUT)]);

        // Card titles are fixed and match the service pages.
        DB::table('website_contents')
            ->where('section', 'services')
            ->whereNull('block_key')
            ->where('title', 'Custom Fabrication')
            ->update(['title' => 'Custom Projects']);

        WebsiteDefaults::applyPhotos();
    }

    public function down(): void
    {
        DB::table('website_content_images')->whereNotNull('slot')->delete();
        DB::table('website_contents')->whereIn('block_key', array_keys(WebsiteDefaults::SERVICE_PAGES))->delete();

        Schema::table('website_content_images', function (Blueprint $table) {
            $table->dropIndex(['content_id', 'slot']);
            $table->dropColumn(['slot', 'thumb_path', 'title', 'caption', 'category', 'homepage_order', 'showcase_order']);
        });
    }
};
