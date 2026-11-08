<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('design_themes', function (Blueprint $table) {
            $table->id('theme_id');
            $table->string('theme_name', 100)->unique();
            $table->string('description', 255)->nullable();
            $table->foreignId('event_type_id')->constrained('event_types', 'event_type_id')->restrictOnDelete();
            $table->unsignedInteger('min_guests')->nullable();
            $table->unsignedInteger('max_guests');
            $table->enum('venue', ['indoor', 'outdoor']);
            $table->string('style', 20);
            $table->string('background_image_path', 500)->nullable();
            $table->json('grid_config')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('design_themes');
    }
};