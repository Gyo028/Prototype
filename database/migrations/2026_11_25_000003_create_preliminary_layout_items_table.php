<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The assets on a preliminary layout.
 *
 * A row is either a library asset (asset_id) or a customer's own "Other"
 * item (asset_id null, with custom_item_category/name/description).
 *
 *  - is_default: the theme's default asset for one of its slots, left as is.
 *  - unit_price / subtotal: copied from the asset when the request is sent,
 *    so later price changes don't touch it. Null for "Other" items, which
 *    are priced later by the Project Manager ("To be priced").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('preliminary_layout_items', function (Blueprint $table) {
            $table->id('layout_item_id');
            $table->foreignId('preliminary_layout_id')->constrained('preliminary_layouts', 'preliminary_layout_id')->cascadeOnDelete();
            $table->foreignId('asset_id')->nullable()->constrained('layout_assets', 'asset_id')->restrictOnDelete();
            $table->boolean('is_default')->default(false);
            $table->unsignedInteger('quantity')->default(1);
            $table->string('custom_item_category', 50)->nullable();
            $table->string('custom_item_name', 50)->nullable();
            $table->string('custom_item_description', 200)->nullable();
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->decimal('subtotal', 10, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('preliminary_layout_items');
    }
};
