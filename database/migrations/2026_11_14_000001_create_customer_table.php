<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One profile per user account. Service requests point to this table (customer_id)
     */
    public function up(): void
    {
        Schema::create('customer', function (Blueprint $table) {
            $table->id('customer_id');
            $table->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->string('first_name', 50);
            $table->string('last_name', 50);
            $table->string('contact_number', 20);
            $table->string('address', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer');
    }
};