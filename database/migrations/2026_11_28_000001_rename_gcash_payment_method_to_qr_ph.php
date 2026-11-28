<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Customers now pay by QR Ph (one QR any bank or e-wallet app can scan)
 * instead of GCash only: payments.payment_method 'gcash' becomes 'qr_ph'.
 *
 * Existing GCash payments are kept and relabelled, since a GCash payment
 * to the business's QR is a QR Ph payment.
 *
 * PostgreSQL (Supabase): Laravel's enum is a varchar with a check constraint,
 * so the constraint is swapped around the update. SQLite (tests): the column
 * is rebuilt with ->change().
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->swap(from: 'gcash', to: 'qr_ph');
    }

    public function down(): void
    {
        $this->swap(from: 'qr_ph', to: 'gcash');
    }

    private function swap(string $from, string $to): void
    {
        $final = [$to, 'cash', 'cheque'];

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check');
            DB::table('payments')->where('payment_method', $from)->update(['payment_method' => $to]);
            $list = implode(', ', array_map(fn (string $v) => "'{$v}'", $final));
            DB::statement("ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method::text IN ({$list}))");

            return;
        }

        // Allow both values while the rows are updated, then keep only the new one.
        Schema::table('payments', fn (Blueprint $table) => $table->enum('payment_method', [$from, $to, 'cash', 'cheque'])->change());
        DB::table('payments')->where('payment_method', $from)->update(['payment_method' => $to]);
        Schema::table('payments', fn (Blueprint $table) => $table->enum('payment_method', $final)->change());
    }
};
