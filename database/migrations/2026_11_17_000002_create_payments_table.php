<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     *  - payment_method  gcash | cash | cheque (customers pay by GCash; the
     *                    Project Manager records cash and cheque payments)
     *  - status          submitted | verified | rejected
     *  - recorded_by     the user who entered the payment (the customer for
     *                    GCash uploads, the Project Manager for cash/cheque)
     *  - remarks         the Project Manager's reason when a payment is rejected
     *
     * A rejected payment stays as history; the customer submits a new one.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id('payment_id');
            $table->foreignId('billing_id')->constrained('billings', 'billing_id')->cascadeOnDelete();
            $table->decimal('amount_paid', 12, 2);
            $table->string('payment_reference', 100);
            $table->dateTime('payment_date');
            $table->string('receipt_file_name', 150)->nullable();
            $table->string('receipt_file_path', 255)->nullable();
            $table->dateTime('submitted_at');
            $table->enum('payment_method', ['gcash', 'cash', 'cheque']);
            $table->enum('status', ['submitted', 'verified', 'rejected'])->default('submitted');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('verified_at')->nullable();
            $table->string('remarks', 255)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
