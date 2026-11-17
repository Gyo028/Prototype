<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Reservation fees not paid by their due date: mark the bill overdue and cancel the project.
Artisan::command('billings:cancel-overdue', function (App\Services\ReservationFees $fees) {
    $this->info($fees->cancelOverdue().' project(s) cancelled for an unpaid reservation fee.');
})->purpose('Cancel projects whose reservation fee was not paid by the due date');

Illuminate\Support\Facades\Schedule::command('billings:cancel-overdue')->dailyAt('00:10')->timezone('Asia/Manila');

// Developers: rebuild the PDFs of contracts nobody has signed yet, after editing
// resources/views/pdf/contract.blade.php or config/contract.php.
Artisan::command('contracts:regenerate', function (App\Services\Contracts $contracts) {
    $this->info($contracts->regenerateUnsigned().' unsigned contract(s) regenerated.');
})->purpose('Rebuild unsigned contract PDFs from the current template');
