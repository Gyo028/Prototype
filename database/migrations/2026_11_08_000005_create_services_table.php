<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id('service_id');
            $table->string('service_name', 100)->unique();
            $table->string('service_category', 50);
            $table->string('description', 255)->nullable();
            $table->enum('pricing_type', ['fixed', 'per_unit'])->default('fixed');
            $table->string('unit_type', 20)->nullable();
            $table->decimal('price', 10, 2);
            $table->enum('status', ['active', 'inactive'])->default('active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};