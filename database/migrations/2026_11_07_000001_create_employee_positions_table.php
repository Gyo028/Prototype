<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * employee_positions table, named exactly as in the ERD:
     * position_id, position_name, description.
     * The starting rows are the positions used on the Technical Admin
     * employee screen, so the position dropdown is never empty.
     */
    public function up(): void
    {
        Schema::create('employee_positions', function (Blueprint $table) {
            $table->id('position_id');
            $table->string('position_name', 50)->unique();
            $table->string('description', 255)->nullable();
        });

        DB::table('employee_positions')->insert([
            ['position_name' => 'Project Manager', 'description' => 'Manages projects and schedules.'],
            ['position_name' => 'Design Specialist', 'description' => 'Prepares design proposals and quotations.'],
            ['position_name' => 'Bookkeeper', 'description' => 'Handles payments, expenses and financial records.'],
            ['position_name' => 'Fabrication Head', 'description' => 'Field personnel who receive fabrication work orders by email.'],
            ['position_name' => 'Installation Head', 'description' => 'Field personnel who receive installation work orders by email.'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_positions');
    }
};