<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * project_schedule
     *
     *  - event         created when the request is approved: 'tentative' until
     *                  the reservation fee is verified, then 'confirmed'.
     *                  Standard: the event date with its start and end time.
     *                  Custom: start_date 00:00 to end_date 23:59:59 (no times).
     *  - consultation, ocular_visit
     *                  booked by the customer; their
     *                  outcomes go to the appointment outcome tables.
     *  - fabrication, installation
     *                  set by the Project Manager for execution.
     */
    public function up(): void
    {
        Schema::create('project_schedules', function (Blueprint $table) {
            $table->id('schedule_id');
            $table->foreignId('project_id')->constrained('projects', 'project_id')->cascadeOnDelete();
            $table->enum('schedule_type', ['event', 'consultation', 'ocular_visit', 'fabrication', 'installation']);
            $table->dateTime('start_datetime');
            $table->dateTime('end_datetime');
            $table->enum('schedule_status', ['pending', 'tentative', 'confirmed', 'completed', 'cancelled'])->default('pending');
            $table->string('remarks', 255)->nullable();

            $table->index(['schedule_type', 'start_datetime']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_schedules');
    }
};
