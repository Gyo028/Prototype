<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * event_types (ERD Figure 14): Corporate, Wedding, Birthday, ...
     * Design themes and service requests refer to them. No timestamps, as in the ERD.
     */
    public function up(): void
    {
        Schema::create('event_types', function (Blueprint $table) {
            $table->id('event_type_id');
            $table->string('event_type_name', 50)->unique();
            $table->string('description', 255)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_types');
    }
};