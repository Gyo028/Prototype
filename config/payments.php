<?php

/*
 * How customers pay.
 *
 * The GCash details are placeholders until the client gives the real ones.
 * Set them in .env, or replace the QR image at public/images/gcash-qr.svg.
 */

return [

    'gcash' => [
        'account_name' => env('GCASH_ACCOUNT_NAME', "GR3AT A's Event Styling Services"),
        'account_number' => env('GCASH_ACCOUNT_NUMBER', '0917 000 0000'),
        'qr_image' => env('GCASH_QR_IMAGE', '/images/gcash-qr.svg'),
        // True while the QR above is the sample one; the page then labels it "Sample QR".
        'is_sample' => (bool) env('GCASH_QR_IS_SAMPLE', true),
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
