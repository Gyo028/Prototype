<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * website_content_images
     * such as the hero background and the Our Works gallery.
     */
    public function up(): void
    {
        Schema::create('website_content_images', function (Blueprint $table) {
            $table->id('image_id');
            $table->foreignId('content_id')->constrained('website_contents', 'content_id')->cascadeOnDelete();
            $table->string('file_path', 500);
            $table->string('alt_text', 255)->nullable();
            $table->integer('sort_order')->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamp('updated_at')->nullable();

            $table->index(['content_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('website_content_images');
    }
};