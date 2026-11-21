<?php

use Illuminate\Support\Facades\Storage;

/*
 * File storage: customer and project files use the default disk; "supabase"
 * is the team's private Supabase Storage bucket. files:copy-to-bucket copies
 * the files on a computer to it.
 */

test('tests always use the local disk, never the real bucket', function () {
    expect(config('filesystems.default'))->toBe('local');
});

test('the supabase disk is a private S3 disk with a path-style endpoint', function () {
    expect(config('filesystems.disks.supabase'))
        ->driver->toBe('s3')
        ->use_path_style_endpoint->toBeTrue()
        ->visibility->toBe('private')
        ->throw->toBeTrue();
});

test('files:copy-to-bucket copies the local files to the bucket at the same paths', function () {
    $local = Storage::fake('local');
    $bucket = Storage::fake('supabase');

    $local->put('customers/1/billings/4/receipts/a.jpg', 'receipt');
    $local->put('customers/1/projects/2/contract/v1/CON-26-0002_v1_Contract.pdf', 'pdf');
    $local->put('.gitignore', '*');

    $this->artisan('files:copy-to-bucket')->assertSuccessful();

    expect($bucket->get('customers/1/billings/4/receipts/a.jpg'))->toBe('receipt')
        ->and($bucket->get('customers/1/projects/2/contract/v1/CON-26-0002_v1_Contract.pdf'))->toBe('pdf')
        ->and($bucket->exists('.gitignore'))->toBeFalse()
        // Nothing is removed from this computer.
        ->and($local->exists('customers/1/billings/4/receipts/a.jpg'))->toBeTrue();
});

test('files the bucket already has are skipped, unless --force', function () {
    $local = Storage::fake('local');
    $bucket = Storage::fake('supabase');

    $local->put('customers/1/a.pdf', 'same');
    $bucket->put('customers/1/a.pdf', 'same');

    $this->artisan('files:copy-to-bucket')
        ->expectsOutputToContain('Copied 0, skipped 1')
        ->assertSuccessful();

    $this->artisan('files:copy-to-bucket --force')
        ->expectsOutputToContain('Copied 1, skipped 0')
        ->assertSuccessful();
});

test('--dry-run copies nothing', function () {
    Storage::fake('local')->put('customers/1/a.pdf', 'x');
    $bucket = Storage::fake('supabase');

    $this->artisan('files:copy-to-bucket --dry-run')
        ->expectsOutputToContain('Would copy 1')
        ->assertSuccessful();

    expect($bucket->exists('customers/1/a.pdf'))->toBeFalse();
});
