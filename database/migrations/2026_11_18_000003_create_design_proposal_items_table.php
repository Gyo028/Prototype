<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The quotation's line items for a design proposal version. 
     * Design_proposals.quotation_amount is their total. 
     * The final billing can reuse them.
     */
    public function up(): void
    {
        Schema::create('design_proposal_items', function (Blueprint $table) {
            $table->id('item_id');
            $table->foreignId('design_proposal_id')->constrained('design_proposals', 'design_proposal_id')->cascadeOnDelete();
            $table->string('item_name', 150);
            $table->string('description', 255)->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->string('unit', 20)->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('subtotal', 10, 2);
            $table->unsignedSmallInteger('sort_order')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('design_proposal_items');
    }
};
