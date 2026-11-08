<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * isometric_icon_path and placement_zone are optional for now: the
     * Technical Admin screen doesn't capture them yet. Assets are switched
     * off, never deleted. No timestamps, as in the ERD.
     */
    public function up(): void
    {
        Schema::create('layout_assets', function (Blueprint $table) {
            $table->id('asset_id');
            $table->string('asset_name', 100)->unique();
            $table->string('asset_category', 50);
            $table->string('description', 255)->nullable();
            $table->string('isometric_icon_path', 500)->nullable();
            $table->enum('placement_zone', ['floor', 'wall', 'ceiling'])->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('layout_assets');
    }
};