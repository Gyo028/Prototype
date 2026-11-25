<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The preliminary 2D layout of a Standard Event Styling request.
 * One per request, saved when the request is sent.
 *
 *  - theme_id: null when no design theme was offered for the event type.
 *  - total_initial_cost: the initial quotation, i.e. the request's services
 *    (with the Event Styling fee) plus the priced layout assets.
 *  - generated_file_path: for the rendered layout picture, later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('preliminary_layouts', function (Blueprint $table) {
            $table->id('preliminary_layout_id');
            $table->foreignId('service_request_id')->unique()->constrained('service_requests', 'service_request_id')->cascadeOnDelete();
            $table->foreignId('theme_id')->nullable()->constrained('design_themes', 'theme_id')->restrictOnDelete();
            $table->decimal('total_initial_cost', 10, 2)->default(0);
            $table->enum('layout_status', ['draft', 'submitted'])->default('submitted');
            $table->timestamp('generated_at')->nullable();
            $table->string('generated_file_path', 255)->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('preliminary_layouts');
    }
};
