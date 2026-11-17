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
