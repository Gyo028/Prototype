<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backlog #35 (Project Manager side, Nov 28): the remarks of the project's last status
     * change (required when it is cancelled; the completion note when installation is done)
     * and when it changed. Decided with the user: 2 columns on projects, no history table.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->text('status_remarks')->nullable();
            $table->timestamp('status_changed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['status_remarks', 'status_changed_at']);
        });
    }
};