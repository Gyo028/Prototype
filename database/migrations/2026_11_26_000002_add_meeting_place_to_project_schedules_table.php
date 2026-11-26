<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where a face-to-face consultation happens: GR3AT A's office or a place the
 * customer chooses (a restaurant, a cafe...), written as one line, e.g.
 * "Café Lorenzo, SM Fairview, Quezon City". The customer's choice is final.
 * Empty for online consultations and for ocular visits (held at the venue).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->string('meeting_place', 255)->nullable()->after('meeting_mode');
        });
    }

    public function down(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->dropColumn('meeting_place');
        });
    }
};
