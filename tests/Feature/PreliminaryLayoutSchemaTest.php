<?php

use App\Models\Customer;
use App\Models\LayoutAsset;
use App\Models\PreliminaryLayout;
use App\Models\PreliminaryLayoutItem;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * preliminary_layouts and preliminary_layout_items, and the migration
 * that moved asset prices off asset_variants.
 */

function plRequest(): ServiceRequest
{
    $customer = Customer::create([
        'user_id' => User::factory()->create()->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => uniqueMobile(),
    ]);

    return ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => 'standard',
        'request_date' => today(),
        'start_date' => today()->addMonths(2),
        'end_date' => today()->addMonths(2),
        'venue' => 'Hall',
        'guest_count' => 100,
        'budget_min' => 50000,
        'budget_max' => 100000,
    ]);
}

test('the tables follow the ERD, with asset_id in place of asset_variant_id', function () {
    expect(Schema::getColumnListing('preliminary_layouts'))->toEqualCanonicalizing([
        'preliminary_layout_id', 'service_request_id', 'theme_id', 'total_initial_cost', 'layout_status',
        'generated_at', 'generated_file_path', 'updated_at',
    ]);
    expect(Schema::getColumnListing('preliminary_layout_items'))->toEqualCanonicalizing([
        'layout_item_id', 'preliminary_layout_id', 'asset_id', 'is_default', 'quantity',
        'custom_item_category', 'custom_item_name', 'custom_item_description', 'unit_price', 'subtotal',
    ]);
});

test('a request has one layout, and its items go with it', function () {
    $this->seed(ServiceAssetSeeder::class);
    $request = plRequest();

    $layout = $request->preliminaryLayout()->create(['total_initial_cost' => 18000, 'generated_at' => now()]);
    $layout->items()->create(['asset_id' => LayoutAsset::value('asset_id'), 'quantity' => 100, 'unit_price' => 45, 'subtotal' => 4500]);
    $layout->items()->create(['custom_item_category' => 'Decors', 'custom_item_name' => 'Neon sign']);

    expect($layout->fresh()->layout_status)->toBe('submitted')
        ->and(PreliminaryLayoutItem::whereNull('asset_id')->first()->subtotal)->toBeNull()
        ->and(PreliminaryLayoutItem::whereNull('asset_id')->first()->is_default)->toBeFalse();

    $request->delete();

    expect(PreliminaryLayout::count())->toBe(0)
        ->and(PreliminaryLayoutItem::count())->toBe(0);
});

test('a second layout for the same request is refused', function () {
    $request = plRequest();

    $request->preliminaryLayout()->create(['total_initial_cost' => 1]);
    $request->preliminaryLayout()->create(['total_initial_cost' => 2]);
})->throws(QueryException::class);

test('an asset on a layout cannot be deleted (it is switched off instead)', function () {
    $this->seed(ServiceAssetSeeder::class);
    $asset = LayoutAsset::firstOrFail();

    plRequest()->preliminaryLayout()->create(['total_initial_cost' => 1])->items()->create(['asset_id' => $asset->asset_id]);

    $asset->delete();
})->throws(QueryException::class);

test('the migration keeps each asset\'s variant price, preferring an active variant', function () {
    // The old asset_variants table, as on a database migrated before the change.
    Schema::create('asset_variants', function (Blueprint $table) {
        $table->id('asset_variant_id');
        $table->foreignId('asset_id')->constrained('layout_assets', 'asset_id');
        $table->string('variant_name', 100);
        $table->decimal('price', 10, 2);
        $table->string('status')->default('active');
    });

    $chairs = LayoutAsset::create(['asset_name' => 'Chairs', 'asset_category' => 'Furniture'])->asset_id;
    $arch = LayoutAsset::create(['asset_name' => 'Arch', 'asset_category' => 'Structures'])->asset_id;
    $bare = LayoutAsset::create(['asset_name' => 'Lights', 'asset_category' => 'Lighting'])->asset_id;

    DB::table('asset_variants')->insert([
        ['asset_id' => $chairs, 'variant_name' => 'Old', 'price' => 30, 'status' => 'inactive'],
        ['asset_id' => $chairs, 'variant_name' => 'Gold', 'price' => 150, 'status' => 'active'],
        ['asset_id' => $arch, 'variant_name' => 'Only', 'price' => 6000, 'status' => 'inactive'],
    ]);

    (require database_path('migrations/2026_11_25_000001_replace_asset_variants_with_asset_price.php'))->up();

    expect(Schema::hasTable('asset_variants'))->toBeFalse()
        ->and(LayoutAsset::find($chairs)->price)->toBe('150.00')
        ->and(LayoutAsset::find($arch)->price)->toBe('6000.00')
        ->and(LayoutAsset::find($bare)->price)->toBeNull()
        ->and(LayoutAsset::find($chairs)->pricing_type)->toBe('fixed');
});
