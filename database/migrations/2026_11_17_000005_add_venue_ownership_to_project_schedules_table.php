<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whose venue an ocular visit is at, chosen by the customer when booking.
     *
     *  - own_property  no site access documents needed; the visit is confirmed right away
     *  - third_party   rented or third-party venue (hotel, mall, events place); the visit
     *                  stays 'pending' until the Project Manager approves the
     *                  authorization letter and the venue permit (site_access_documents)
     *
     * Null for every other schedule type.
     */
    public function up(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->enum('venue_ownership', ['own_property', 'third_party'])->nullable()->after('meeting_mode');
        });
    }

    public function down(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->dropColumn('venue_ownership');
        });
    }
};
