<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reference codes with the year and a number that starts again every year:
     * service requests "REQ-26-0001", projects "PRJ-26-0001". A contract uses its
     * project's number ("CON-26-0001"), so it needs no column of its own.
     *
     * The year is the year the record was created (Manila time). Saved records
     * get theirs here, in the order they were created. The column is nullable
     * only because a new record gets its code right after it is saved
     * (App\Models\Concerns\HasYearlyCode).
     */
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->string('request_code', 16)->nullable()->unique()->after('service_request_id');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->string('project_code', 16)->nullable()->unique()->after('project_id');
        });

        $this->backfill('service_requests', 'service_request_id', 'request_code', 'REQ');
        $this->backfill('projects', 'project_id', 'project_code', 'PRJ');
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropUnique(['project_code']);
            $table->dropColumn('project_code');
        });

        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropUnique(['request_code']);
            $table->dropColumn('request_code');
        });
    }

    private function backfill(string $table, string $key, string $column, string $prefix): void
    {
        $counts = [];

        DB::table($table)->orderBy('created_at')->orderBy($key)->select([$key, 'created_at'])->get()
            ->each(function (\stdClass $row) use ($table, $key, $column, $prefix, &$counts) {
                $year = Carbon::parse($row->created_at ?? 'now')->timezone('Asia/Manila')->format('y');
                $counts[$year] = ($counts[$year] ?? 0) + 1;

                DB::table($table)->where($key, $row->{$key})->update([$column => sprintf('%s-%s-%04d', $prefix, $year, $counts[$year])]);
            });
    }
};
