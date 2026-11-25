<?php

use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Brings an already-seeded database (the shared Supabase one) in line with
 * the new sample data. A fresh database has nothing yet and the seeder does
 * the same work, so this changes nothing there.
 *
 *  - The Event Styling fee drops from ₱45,000 to ₱10,000, unless the
 *    Technical Admin already set another price.
 *  - Sample assets that have no price yet get their sample price.
 *  - Sample themes without a default set get theirs.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('services')
            ->where('service_name', 'Event Styling')
            ->where('price', 45000)
            ->update(['price' => ServiceAssetSeeder::STYLING_FEE]);

        ServiceAssetSeeder::fillAssetPrices();
        ServiceAssetSeeder::fillThemeDefaultSets();
    }

    public function down(): void
    {
        DB::table('services')
            ->where('service_name', 'Event Styling')
            ->where('price', ServiceAssetSeeder::STYLING_FEE)
            ->update(['price' => 45000]);
    }
};
