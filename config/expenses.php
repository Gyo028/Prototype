<?php

/*
 * Project expenses recorded by the Bookkeeper.
 */

return [

    // Proof of the expense (official receipt, invoice, delivery receipt...). Optional.
    'receipt' => [
        'max_mb' => 5,
        'mimes' => ['pdf', 'jpg', 'jpeg', 'png'],
    ],

];
