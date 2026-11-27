<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Project Manager side, for fabrication and installation schedules only (empty otherwise):
     *   - Backlog #32 (Nov 26–27): the employee responsible for it (the Fabrication Head or the
     *     Installation Head) and the activity (acceptance criterion: activity, scheduled date,
     *     target completion date).
     *   - Backlog #33 (Nov 27): the work order emailed to that Head: the Project Manager's
     *     instructions and when it was sent. A rescheduled phase gets a new schedule row,
     *     so its work order starts empty and must be sent again.
     *   - Adviser revision G3 (Nov 27): the online meeting link (e.g. Google Meet) the Project
     *     Manager sends for an online consultation (consultations only).
     */
    public function up(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->foreignId('assigned_employee_id')->nullable()
                ->constrained('employees', 'employee_id')->nullOnDelete();
            $table->string('activity', 255)->nullable();
            $table->text('work_order_instructions')->nullable();
            $table->timestamp('work_order_sent_at')->nullable();
            $table->string('meeting_link', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->dropColumn(['activity', 'work_order_instructions', 'work_order_sent_at', 'meeting_link']);
            $table->dropConstrainedForeignId('assigned_employee_id');
        });
    }
};