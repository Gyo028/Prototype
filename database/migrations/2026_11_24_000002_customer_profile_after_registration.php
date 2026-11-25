<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Registration now asks only for the name, email and password. The customer
 * adds the contact number (and, if they like, company and address) later on
 * My Profile, before sending their first service request.
 *
 *  - contact_number: nullable until the profile is completed, and unique
 *    (one account per mobile number). Saved as 09XXXXXXXXX.
 *  - company_name: optional.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Same format everywhere, so "+639171234567" and "09171234567" count as one number.
        DB::table('customer')->whereNotNull('contact_number')->orderBy('customer_id')
            ->each(function (object $row) {
                $clean = preg_replace('/[\s\-().]/', '', (string) $row->contact_number);
                $clean = preg_replace('/^\+63/', '0', $clean);

                if ($clean !== $row->contact_number) {
                    DB::table('customer')->where('customer_id', $row->customer_id)->update(['contact_number' => $clean]);
                }
            });

        $duplicates = DB::table('customer')
            ->select('contact_number', DB::raw('count(*) as total'))
            ->whereNotNull('contact_number')
            ->groupBy('contact_number')
            ->havingRaw('count(*) > 1')
            ->pluck('contact_number');

        if ($duplicates->isNotEmpty()) {
            throw new RuntimeException(
                'Some customers share a contact number, so it cannot be made unique: '
                .$duplicates->implode(', ')
                .'. Change or clear the extra ones in the customer table, then run the migration again.'
            );
        }

        Schema::table('customer', function (Blueprint $table) {
            $table->string('contact_number', 20)->nullable()->change();
            $table->string('company_name', 100)->nullable()->after('last_name');
            $table->unique('contact_number');
        });
    }

    public function down(): void
    {
        Schema::table('customer', function (Blueprint $table) {
            $table->dropUnique(['contact_number']);
            $table->dropColumn('company_name');
        });

        DB::table('customer')->whereNull('contact_number')->update(['contact_number' => '']);

        Schema::table('customer', function (Blueprint $table) {
            $table->string('contact_number', 20)->nullable(false)->change();
        });
    }
};
