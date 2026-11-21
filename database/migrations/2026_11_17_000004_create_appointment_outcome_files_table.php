<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Files attached to an appointment outcome.
     *
     *  - report      the site assessment report (PDF or DOCX, required for an ocular visit)
     *  - photo       venue photos (JPG, PNG, WEBP)
     *  - attachment  any other document (e.g. consultation notes as PDF, DOCX or XLSX)
     */
    public function up(): void
    {
        Schema::create('appointment_outcome_files', function (Blueprint $table) {
            $table->id('outcome_file_id');
            $table->foreignId('outcome_id')->constrained('appointment_outcomes', 'outcome_id')->cascadeOnDelete();
            $table->enum('file_type', ['report', 'photo', 'attachment']);
            $table->string('file_name', 255);
            $table->string('file_path', 500);
            $table->timestamp('uploaded_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_outcome_files');
    }
};
