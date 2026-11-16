<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Mall Activation is now a Custom Project, not an event type.
     *
     * Records are never deleted (themes refer to event types), so a database
     * that was seeded earlier gets the old Mall Activation event type and its
     * themes switched off. Customers only see active ones. On a fresh database
     * there is nothing to change.
     */
    public function up(): void
    {
        $mallId = DB::table('event_types')->where('event_type_name', 'Mall Activation')->value('event_type_id');

        if ($mallId === null) {
            return;
        }

        DB::table('event_types')->where('event_type_id', $mallId)->update(['status' => 'inactive']);
        DB::table('design_themes')->where('event_type_id', $mallId)->update(['status' => 'inactive']);
    }

    public function down(): void
    {
        $mallId = DB::table('event_types')->where('event_type_name', 'Mall Activation')->value('event_type_id');

        if ($mallId === null) {
            return;
        }

        DB::table('event_types')->where('event_type_id', $mallId)->update(['status' => 'active']);
        DB::table('design_themes')->where('event_type_id', $mallId)->update(['status' => 'active']);
    }
};