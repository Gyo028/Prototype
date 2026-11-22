<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Money the business spends on a project, recorded by the Bookkeeper.
     * Expenses can be logged at any step of the project (e.g. transportation
     * for an ocular visit), not only during fabrication.
     *
     *  - expense_type       materials | fabrication | equipment_rental | labor | transportation (App\Enums\ExpenseType)
     *  - receipt_file_*     the proof of the expense; optional so it can be attached later
     *  - recorded_by        the user who first recorded it
     *  - archived_at        set when archived; archived expenses are left out of totals
     *                       and reports, and can be restored (no permanent delete)
     *
     * Every change (who, when, old -> new) is kept in project_expense_histories.
     */
    public function up(): void
    {
        Schema::create('project_expenses', function (Blueprint $table) {
            $table->id('expense_id');
            $table->foreignId('project_id')->constrained('projects', 'project_id')->restrictOnDelete();
            $table->enum('expense_type', ['materials', 'fabrication', 'equipment_rental', 'labor', 'transportation']);
            $table->decimal('amount', 10, 2);
            $table->date('expense_date');
            $table->string('description', 255);
            $table->string('receipt_file_name', 150)->nullable();
            $table->string('receipt_file_path', 255)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('recorded_at');
            $table->dateTime('archived_at')->nullable();

            $table->index(['project_id', 'expense_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_expenses');
    }
};
