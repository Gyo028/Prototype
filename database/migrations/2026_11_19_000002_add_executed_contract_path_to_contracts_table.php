<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The fully signed contract: made when the Project Manager verifies the
     * customer's signed copy, with the customer's signature (or a note that
     * a signed paper copy was uploaded) and the Owner's signature.
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->string('executed_contract_path', 255)->nullable()->after('signed_contract_path');
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn('executed_contract_path');
        });
    }
};
