<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When the work was actually finished (fabrication, installation), set when
     * the Project Manager marks it done with photo proof. The photos and note
     * are stored like the site assessment: appointment_outcomes(+files).
     */
    public function up(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->timestamp('completed_at')->nullable()->after('schedule_status');
        });
    }

    public function down(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });
    }
};
