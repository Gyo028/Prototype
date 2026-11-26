<?php

use App\Support\WebsiteDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The public footer and pages now show the Contact & Footer row. The first
 * seeder left placeholders in it (phone, a shorter address, an older copyright
 * line), so each of those is replaced with the real details, but only while it
 * still holds the placeholder: anything the Technical Admin saved stays.
 */
return new class extends Migration
{
    private const PLACEHOLDERS = [
        'phone' => '+63 0000000000',
        'address' => 'Altezza, Deparo, Caloocan City',
        'copyright' => "© 2026 Great A's Event Styling Services. All rights reserved.",
    ];

    public function up(): void
    {
        $row = DB::table('website_contents')->where('block_key', 'contact')->first();

        if ($row === null) {
            return;
        }

        $contact = json_decode((string) $row->content, true) ?: [];
        $changed = false;

        foreach (self::PLACEHOLDERS as $key => $placeholder) {
            if (($contact[$key] ?? null) === $placeholder) {
                $contact[$key] = WebsiteDefaults::CONTACT[$key];
                $changed = true;
            }
        }

        if ($changed) {
            DB::table('website_contents')->where('block_key', 'contact')->update([
                'content' => json_encode($contact, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }

    public function down(): void
    {
        // Nothing to undo: the placeholders are not worth restoring.
    }
};
