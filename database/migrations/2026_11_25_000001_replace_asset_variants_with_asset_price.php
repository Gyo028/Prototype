<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 *  - price: the asset's one price. Null = not priced yet, and the asset is
 *    not offered to customers until the Technical Admin adds one.
 *  - pricing_type: fixed (counted once) or per_guest (counted from the
 *    guest count, e.g. chairs).
 *  - guests_per_unit: per_guest assets only. 1 for chairs (one per guest),
 *    10 for tables (one per 10 guests). Quantity = guests ÷ this, rounded up.
 *
 * Each asset keeps a price it already had: its first active variant's (or
 * else its first variant's) price is copied over before the table is dropped.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('layout_assets', 'price')) {
            Schema::table('layout_assets', function (Blueprint $table) {
                $table->decimal('price', 10, 2)->nullable();
                $table->enum('pricing_type', ['fixed', 'per_guest'])->default('fixed');
                $table->unsignedInteger('guests_per_unit')->nullable();
            });
        }

        if (Schema::hasTable('asset_variants')) {
            $variants = DB::table('asset_variants')
                ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
                ->orderBy('asset_variant_id')
                ->get(['asset_id', 'price']);

            foreach ($variants->unique('asset_id') as $variant) {
                DB::table('layout_assets')
                    ->where('asset_id', $variant->asset_id)
                    ->update(['price' => $variant->price]);
            }

            Schema::drop('asset_variants');
        }
    }

    public function down(): void
    {
        Schema::create('asset_variants', function (Blueprint $table) {
            $table->id('asset_variant_id');
            $table->foreignId('asset_id')->constrained('layout_assets', 'asset_id')->restrictOnDelete();
            $table->string('variant_name', 100);
            $table->string('description', 255)->nullable();
            $table->decimal('price', 10, 2);
            $table->enum('status', ['active', 'inactive'])->default('active');

            $table->unique(['asset_id', 'variant_name']);
        });

        // Each priced asset gets one "Standard" variant back.
        foreach (DB::table('layout_assets')->whereNotNull('price')->get(['asset_id', 'price']) as $asset) {
            DB::table('asset_variants')->insert([
                'asset_id' => $asset->asset_id,
                'variant_name' => 'Standard',
                'price' => $asset->price,
            ]);
        }

        Schema::table('layout_assets', function (Blueprint $table) {
            $table->dropColumn(['price', 'pricing_type', 'guests_per_unit']);
        });
    }
};
