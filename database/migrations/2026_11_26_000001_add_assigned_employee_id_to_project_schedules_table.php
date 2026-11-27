<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backlog #32 (Project Manager side, Nov 26): the employee responsible for a
     * fabrication or installation schedule (the Fabrication Head or the Installation
     * Head). Empty for every other schedule type.
     */
    public function up(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
            $table->foreignId('assigned_employee_id')->nullable()
                ->constrained('employees', 'employee_id')->nullOnDelete();
                $table->text('work_order_instructions')->nullable();
            $table->timestamp('work_order_sent_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('project_schedules', function (Blueprint $table) {
        $table->dropColumn(['work_order_instructions', 'work_order_sent_at']);
        $table->dropConstrainedForeignId('assigned_employee_id');
        });
    }
};