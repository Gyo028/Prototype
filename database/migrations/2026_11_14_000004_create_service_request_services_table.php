<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The services on a standard request, including the "Event Styling" base fee as its own row.
     *
     * unit_price is copied from services.price when the request is submitted,
     * so a later price change never alters a request that is already saved.
     * A service appears at most once per request.
     */
    public function up(): void
    {
        Schema::create('service_request_services', function (Blueprint $table) {
            $table->id('request_service_id');
            $table->foreignId('service_request_id')->constrained('service_requests', 'service_request_id')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services', 'service_id')->restrictOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('subtotal', 12, 2);

            $table->unique(['service_request_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_request_services');
    }
};