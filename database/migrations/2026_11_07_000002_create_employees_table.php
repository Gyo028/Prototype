<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * employees table, named exactly as in the ERD (user story 09 and the
     * Manage Operational Accounts and Employee Records use case).
     *
     * user_id is optional: field personnel (Fabrication / Installation Heads)
     * have no login and are reached by email for work orders, while office
     * staff with a login are linked to their account (one account per
     * employee). Every other column is required, so an incomplete record
     * cannot be saved (acceptance criterion 2 of story 09).
     */
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id('employee_id');
            $table->foreignId('user_id')->nullable()->unique()->constrained('users')->nullOnDelete();
            $table->foreignId('position_id')->constrained('employee_positions', 'position_id')->restrictOnDelete();
            $table->string('first_name', 50);
            $table->string('last_name', 50);
            $table->string('contact_number', 20);
            $table->string('email', 100);
            $table->enum('employee_status', ['active', 'inactive'])->default('active'); // inactive = archived
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};