<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Documents that let our team inspect a third-party venue without the
     * customer: the customer's authorization letter and the venue's
     * permit. One file each (PDF, JPG or PNG, up to 5 MB).
     *
     * Linked to the project, not the booking, so they survive a reschedule.
     * Replacing a file keeps the old row with replaced_at set (history); the
     * current file of each type has replaced_at = null.
     *
     * The Project Manager approves or rejects each file (remarks = the reason).
     */
    public function up(): void
    {
        Schema::create('site_access_documents', function (Blueprint $table) {
            $table->id('document_id');
            $table->foreignId('project_id')->constrained('projects', 'project_id')->cascadeOnDelete();
            $table->enum('document_type', ['authorization_letter', 'venue_permit']);
            $table->string('file_name', 255);
            $table->string('file_path', 500);
            $table->enum('status', ['submitted', 'approved', 'rejected'])->default('submitted');
            $table->string('remarks', 255)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('uploaded_at')->useCurrent();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('replaced_at')->nullable();

            $table->index(['project_id', 'document_type', 'replaced_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_access_documents');
    }
};
