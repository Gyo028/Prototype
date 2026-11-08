<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * website_contents.
     *
     */
    public function up(): void
    {
        Schema::create('website_contents', function (Blueprint $table) {
            $table->id('content_id');
            $table->enum('section', ['homepage', 'gallery', 'faq', 'services']);
            $table->string('block_key', 30)->nullable()->unique();
            $table->string('title', 150);
            $table->text('content')->nullable();
            $table->integer('sort_order')->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('updated_at')->nullable();

            $table->index(['section', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('website_contents');
    }
};