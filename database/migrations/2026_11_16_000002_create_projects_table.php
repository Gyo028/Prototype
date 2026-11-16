<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One project per approved service request.
     *
     * Columns filled later:
     *  - design_specialist_id, design_assigned_at
     *  - customer_rating, customer_review_text,
     *    customer_reviewed_at, featured_on_website     
     */
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id('project_id');
            $table->foreignId('service_request_id')->unique()->constrained('service_requests', 'service_request_id')->restrictOnDelete();
            $table->foreignId('project_manager_id')->constrained('employees', 'employee_id')->restrictOnDelete();
            $table->foreignId('design_specialist_id')->nullable()->constrained('employees', 'employee_id')->restrictOnDelete();
            $table->foreignId('current_status_id')->constrained('project_statuses', 'status_id')->restrictOnDelete();
            $table->timestamp('design_assigned_at')->nullable();
            $table->enum('customer_proceed_decision', ['proceed', 'hold', 'cancelled'])->nullable();
            $table->boolean('ocular_visit_required')->nullable();
            $table->unsignedTinyInteger('customer_rating')->nullable();
            $table->string('customer_review_text', 255)->nullable();
            $table->timestamp('customer_reviewed_at')->nullable();
            $table->boolean('featured_on_website')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
