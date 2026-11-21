<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Optional reference files a customer uploads with a request (JPG, PNG or PDF, up to 10 MB each,
     * at most 10 per request; enforced when the request is submitted).
     */
    public function up(): void
    {
        Schema::create('service_request_files', function (Blueprint $table) {
            $table->id('request_file_id');
            $table->foreignId('service_request_id')->constrained('service_requests', 'service_request_id')->cascadeOnDelete();
            $table->string('file_name', 255);
            $table->string('file_path', 500);
            $table->timestamp('uploaded_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_request_files');
    }
};