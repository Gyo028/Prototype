<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Files of a design proposal version (ERD design_proposal_files, plus file_category).
     *
     *  - design_2d         the 2D design proposal (required; PDF or image)
     *  - visualization_3d  optional 3D output (PDF or a raw project file); over 50 MB
     *                      goes in design_proposals.external_link instead
     *  - other             anything else the designer attaches
     */
    public function up(): void
    {
        Schema::create('design_proposal_files', function (Blueprint $table) {
            $table->id('proposal_file_id');
            $table->foreignId('design_proposal_id')->constrained('design_proposals', 'design_proposal_id')->cascadeOnDelete();
            $table->enum('file_category', ['design_2d', 'visualization_3d', 'other']);
            $table->string('file_name', 255);
            $table->string('file_path', 500);
            $table->timestamp('uploaded_at')->useCurrent();
            $table->boolean('is_current')->default(true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('design_proposal_files');
    }
};
