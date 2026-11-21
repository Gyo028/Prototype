<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Design proposals (Plan Project step 4). One row per version: the Design Specialist submits it, the Project Manager and the
     * Owner review it, then the customer approves it or asks for a revision. A revision is a new row with the next version_number.
     *
     *  - owner_review_decision, owner_remarks, owner_reviewed_at  (the Owner's review)
     *  - pm_remarks, owner_remarks, customer_remarks in place of the single `remarks`
     *  - pm_reviewed_at
     *  - external_link  (3D files over 50 MB: Google Drive or OneDrive link)
     *
     * The customer sees a version once it is submitted and approved by both the
     * Project Manager and the Owner.
     */
    public function up(): void
    {
        Schema::create('design_proposals', function (Blueprint $table) {
            $decisions = ['pending', 'approved', 'revision_requested'];

            $table->id('design_proposal_id');
            $table->foreignId('project_id')->constrained('projects', 'project_id')->cascadeOnDelete();
            $table->foreignId('design_specialist_id')->nullable()->constrained('employees', 'employee_id')->nullOnDelete();
            $table->unsignedSmallInteger('version_number');
            $table->decimal('quotation_amount', 10, 2)->default(0);
            $table->enum('status', ['draft', 'submitted'])->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->string('external_link', 500)->nullable();

            $table->enum('pm_review_decision', $decisions)->default('pending');
            $table->text('pm_remarks')->nullable();
            $table->timestamp('pm_reviewed_at')->nullable();

            $table->enum('owner_review_decision', $decisions)->default('pending');
            $table->text('owner_remarks')->nullable();
            $table->timestamp('owner_reviewed_at')->nullable();

            $table->enum('customer_decision', $decisions)->default('pending');
            $table->text('customer_remarks')->nullable();
            $table->timestamp('decision_date')->nullable();

            $table->timestamps();

            $table->unique(['project_id', 'version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('design_proposals');
    }
};
