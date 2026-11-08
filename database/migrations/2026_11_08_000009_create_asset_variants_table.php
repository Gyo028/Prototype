<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A variant name is unique within its own asset. An asset with variants
     * can't be deleted (it is switched off instead). No timestamps, as in the ERD.
     */
    public function up(): void
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
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_variants');
    }
};