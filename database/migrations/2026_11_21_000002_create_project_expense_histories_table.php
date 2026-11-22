<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The change trail of each expense: who did what, and when.
     * Rows are only ever added, never edited or deleted.
     *
     *  - action      created | updated | receipt_attached | receipt_replaced | archived | restored
     *  - changes     for "updated": {"amount": {"old": "1500.00", "new": "1800.00"}, ...}
     *                for receipt actions: {"receipt": {"old": "old.pdf", "new": "new.pdf"}}
     *                null for created / archived / restored
     *  - changed_by  the user who made the change
     */
    public function up(): void
    {
        Schema::create('project_expense_histories', function (Blueprint $table) {
            $table->id('history_id');
            $table->foreignId('expense_id')->constrained('project_expenses', 'expense_id')->cascadeOnDelete();
            $table->enum('action', ['created', 'updated', 'receipt_attached', 'receipt_replaced', 'archived', 'restored']);
            $table->json('changes')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('changed_at');

            $table->index(['expense_id', 'changed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_expense_histories');
    }
};
