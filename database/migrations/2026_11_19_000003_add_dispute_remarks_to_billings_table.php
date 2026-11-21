<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     *  - dispute_remarks          the Project Manager's explanation of the outcome
     *  - dispute_proof_file_name  the proof file's original name, for display
     */
    public function up(): void
    {
        Schema::table('billings', function (Blueprint $table) {
            $table->string('dispute_proof_file_name', 150)->nullable()->after('dispute_proof_file_path');
            $table->text('dispute_remarks')->nullable()->after('dispute_resolution');
        });
    }

    public function down(): void
    {
        Schema::table('billings', function (Blueprint $table) {
            $table->dropColumn(['dispute_proof_file_name', 'dispute_remarks']);
        });
    }
};
