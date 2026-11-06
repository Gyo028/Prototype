<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Replace the old `users.role` text column with `users.role_id` (foreign key
     * to roles) and add `account_status`, as in the ERD. Existing users keep
     * the role they already had.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('email')->constrained('roles')->restrictOnDelete();
            $table->string('account_status')->default('active')->after('role_id'); // active | disabled
        });

        // Carry over each existing user's role, then default anyone left to customer.
        DB::statement('update users set role_id = (select roles.id from roles where roles.name = users.role)');

        $customerId = DB::table('roles')->where('name', 'customer')->value('id');
        DB::table('users')->whereNull('role_id')->update(['role_id' => $customerId]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('customer')->after('email');
        });

        DB::statement('update users set role = (select roles.name from roles where roles.id = users.role_id)');

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
            $table->dropColumn('account_status');
        });
    }
};