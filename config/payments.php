<?php

/*
 * How customers pay.
 *
 * QR Ph: the national QR standard, so one code works with any bank or
 * e-wallet app (GCash, Maya, BPI, BDO…). The client generates it from their
 * business bank or e-wallet account. Until then the sample QR is shown and
 * labelled "Sample QR". Set the real one in .env (QRPH_QR_IMAGE, a path under
 * public/) and set QRPH_QR_IS_SAMPLE=false.
 */

return [

    'qr_ph' => [
        'account_name' => env('QRPH_ACCOUNT_NAME', "GR3AT A's Event Styling Services"),
        'qr_image' => env('QRPH_QR_IMAGE', '/images/gcash-qr.svg'),
        // True while the QR above is the sample one; the page then labels it "Sample QR".
        'is_sample' => (bool) env('QRPH_QR_IS_SAMPLE', true),
    ],

    'reservation_fee' => [
        // Share of the budget range (max, or min when there is no max).
        'rate' => 0.10,
        // Days the customer has to pay after the bill is issued.
        'due_days' => 7,
    ],

    'receipt' => [
        'max_mb' => 5,
        'mimes' => ['pdf', 'jpg', 'jpeg', 'png'],
    ],

];
