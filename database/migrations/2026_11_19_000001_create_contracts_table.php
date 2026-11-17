<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Project contracts (Plan Project step 5). One row per
     * version: the contract is issued when the customer approves the design,
     * the customer signs it (e-sign or upload), and the Project Manager
     * verifies or rejects it. A rejection issues the next version.
     *
     *  - design_proposal_id   the approved design version the contract is for
     *  - version_number       1, 2, ... (unique per project)
     *  - contract_file_path   the generated, unsigned PDF
     *  - contract_data        the values the PDF was made from (amounts, items,
     *                         terms), so a signed contract never changes
     *  - sign_method          electronic | upload
     *  - signer_name          the name typed when e-signing
     *  - signed_file_name     the uploaded file's name, or the generated one
     *  - reviewed_by, reviewed_at, checklist   the Project Manager's review
     *  - rejection_reason is text (the ERD has varchar(255))
     */
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id('contract_id');
            $table->foreignId('project_id')->constrained('projects', 'project_id')->cascadeOnDelete();
            $table->foreignId('design_proposal_id')->nullable()->constrained('design_proposals', 'design_proposal_id')->nullOnDelete();
            $table->unsignedSmallInteger('version_number');
            $table->enum('status', ['issued', 'signed', 'verified', 'rejected'])->default('issued');

            $table->timestamp('issued_at');
            $table->string('contract_file_path', 255);
            $table->json('contract_data');

            $table->timestamp('signed_at')->nullable();
            $table->enum('sign_method', ['electronic', 'upload'])->nullable();
            $table->string('signer_name', 150)->nullable();
            $table->string('signed_file_name', 150)->nullable();
            $table->string('signed_contract_path', 255)->nullable();

            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->json('checklist')->nullable();

            $table->timestamps();

            $table->unique(['project_id', 'version_number']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
