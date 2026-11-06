<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The roles table from the ERD. The six rows are inserted here (not in a
     * seeder) because every user must point to one, including on a fresh database.
     * The `name` values must match the cases of App\Enums\Role.
     */
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();   // key used in code, e.g. technical_admin
            $table->string('label');            // display name, e.g. Technical Admin
            $table->string('description')->nullable();
            $table->timestamps();
        });

        $now = now();

        DB::table('roles')->insert([
            ['name' => 'customer', 'label' => 'Customer', 'description' => 'Avails the business services and submits project requests.', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'project_manager', 'label' => 'Project Manager', 'description' => 'Manages the projects for the business.', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'design_specialist', 'label' => 'Design Specialist', 'description' => 'Views assigned projects and submits design proposals.', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'bookkeeper', 'label' => 'Bookkeeper', 'description' => 'Manages the company financial records and reports.', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'owner', 'label' => 'Owner', 'description' => 'Accesses the business dashboard and reports.', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'technical_admin', 'label' => 'Technical Admin', 'description' => 'Manages user accounts and system configuration.', 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};