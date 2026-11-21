<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Two new project_schedules columns for consultation (and later ocular
     * visit) bookings:
     *
     *  - meeting_mode  online | face_to_face (null for event, fabrication and
     *                  installation rows)
     *  - changed_by    the user who rescheduled or cancelled the appointment
     *                  (customer or Project Manager); the reason goes in remarks.
     *
     * A reschedule keeps history: the old row becomes 'cancelled' and a new
     * row is added for the new date.
     */
    public function up(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->enum('meeting_mode', ['online', 'face_to_face'])->nullable()->after('schedule_status');
            $table->foreignId('changed_by')->nullable()->after('remarks')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->dropConstrainedForeignId('changed_by');
            $table->dropColumn('meeting_mode');
        });
    }
};
