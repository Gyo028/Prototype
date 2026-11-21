<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Standard Event Styling and Custom Projects.
     *
     *  - request_type   standard | custom
     *  - event_type_id  standard only (null for custom)
     *  - project_title  custom only (free text)
     *  - request_date   the day the request was submitted
     *  - start_date / end_date
     *                   standard: both are the event date; custom: the date range
     *  - event_start_time / event_end_time
     *                   standard only (custom projects have no times)
     *  - guest_count    standard only
     *  - budget_min / budget_max
     *                   the chosen range as numbers. "Below 50,000" is 0 to 50,000;
     *                   "Above 500,000" has no maximum (budget_max is null).
     */
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id('service_request_id');
            $table->foreignId('customer_id')->constrained('customer', 'customer_id')->restrictOnDelete();
            $table->enum('request_type', ['standard', 'custom']);
            $table->foreignId('event_type_id')->nullable()->constrained('event_types', 'event_type_id')->restrictOnDelete();
            $table->string('project_title', 150)->nullable();
            $table->date('request_date');
            $table->date('start_date');
            $table->date('end_date');
            $table->time('event_start_time')->nullable();
            $table->time('event_end_time')->nullable();
            $table->string('venue', 255);
            $table->unsignedInteger('guest_count')->nullable();
            $table->decimal('budget_min', 12, 2);
            $table->decimal('budget_max', 12, 2)->nullable();
            $table->text('project_description')->nullable();
            $table->enum('request_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('pm_remarks')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_requests');
    }
};