<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     *  - billing_type  reservation_fee | final_billing | additional_charge
     *  - status        issued | paid | overdue
     *
     * The reservation fee is 10% of the budget range (max, or min when there is
     * no max), due 7 days after it is issued. If it is not paid by then, the
     * bill becomes 'overdue' and the project is cancelled.
     */
    public function up(): void
    {
        Schema::create('billings', function (Blueprint $table) {
            $table->id('billing_id');
            $table->foreignId('project_id')->constrained('projects', 'project_id')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->enum('billing_type', ['reservation_fee', 'final_billing', 'additional_charge']);
            $table->dateTime('issued_at');
            $table->date('due_date');
            $table->enum('status', ['issued', 'paid', 'overdue'])->default('issued');
            $table->string('description', 255)->nullable();
            $table->text('dispute_details')->nullable();
            $table->string('dispute_proof_file_path', 255)->nullable();
            $table->enum('dispute_status', ['pending', 'reviewed', 'resolved'])->nullable();
            $table->enum('dispute_resolution', ['upheld', 'rejected', 'adjusted'])->nullable();
            $table->dateTime('dispute_submitted_at')->nullable();
            $table->dateTime('dispute_resolved_at')->nullable();

            $table->index(['billing_type', 'status', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billings');
    }
};
