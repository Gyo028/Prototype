<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What came out of a consultation or an ocular visit (Plan Project),
     * one row per held appointment in project_schedules.
     *
     *  - consultation: the Project Manager's notes
     *  - ocular visit: the site assessment findings; the report and
     *    venue photos go in appointment_outcome_files
     *
     * The Project Manager records it; the customer can view it.
     */
    public function up(): void
    {
        Schema::create('appointment_outcomes', function (Blueprint $table) {
            $table->id('outcome_id');
            $table->foreignId('schedule_id')->unique()->constrained('project_schedules', 'schedule_id')->cascadeOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_outcomes');
    }
};
