<?php

/*
 * The project contract.
 *
 * Developers: edit the values here; edit the layout in
 * resources/views/pdf/contract.blade.php.
 *
 * A contract keeps the values it was issued with (they are saved with it), so
 * changes here apply to contracts issued after the change. While developing,
 * `php artisan contracts:regenerate` rebuilds the PDFs of contracts nobody has
 * signed yet.
 *
 * The clauses below are placeholders until the client gives the real terms.
 */

return [

    // The business, as it appears on the contract.
    'business' => [
        'name' => "GR3AT A's Event Styling Services",
        'address' => env('CONTRACT_BUSINESS_ADDRESS') ?: 'Business address to follow',
        'contact' => env('CONTRACT_BUSINESS_CONTACT') ?: 'Contact number and email to follow',
        // Who signs for the business (a test name until the client gives the real one).
        'representative' => env('CONTRACT_BUSINESS_REPRESENTATIVE') ?: 'Angela Santiago',
        'representative_title' => 'Owner',
    ],

    /*
     * The Owner's signature, added to the contract when the Project Manager
     * verifies it. This is a sample for testing: replace the file with the real
     * signature as SVG or JPG (both work without the PHP GD extension; a PNG
     * needs GD), or point this to another file.
     */
    'owner_signature' => env('CONTRACT_OWNER_SIGNATURE') ?: resource_path('signatures/owner-signature.svg'),

    // Logo at the top of the PDF. A JPG works without the PHP GD extension.
    'logo' => public_path('images/contract-logo.jpg'),

    /*
     * Final billing: the approved quotation minus the reservation fee, in two
     * parts. To be confirmed with the client at the Sprint 3 demo.
     */
    'payment' => [
        // Share of the final billing paid as the down payment (the rest is the balance).
        'down_payment_percent' => 50,
        // The down payment is due this many days after the contract is verified.
        'down_payment_due_days' => 7,
        // The balance is due this many days before the event (never before the down payment).
        'balance_due_days_before_event' => 14,
    ],

    /*
     * Tests only: skip dompdf and save a tiny placeholder PDF instead (the
     * Blade template is still rendered, so template errors still fail). The
     * contract tests switch this off to check a real PDF is made.
     */
    'fake_pdf' => (bool) env('CONTRACT_FAKE_PDF', false),

    // A physically signed copy the customer uploads.
    'upload' => [
        'max_mb' => 10,
        'mimes' => ['pdf', 'jpg', 'jpeg', 'png'],
    ],

    /*
     * The clauses, in order: heading => text. Add, remove or reorder freely.
     * These placeholders can be used in the text:
     *   :down_percent  :balance_percent  :down_due_days  :balance_due_days
     */
    'terms' => [
        'Scope of services' => 'The Service Provider will provide the event styling services and items listed in the approved quotation attached to this contract. Changes to the scope after signing are treated as additional charges and are billed separately.',
        'Payment' => 'The Client pays the final billing in two parts: a :down_percent% down payment due :down_due_days days after this contract is verified, and the remaining :balance_percent% balance due :balance_due_days days before the event. The reservation fee already paid is deducted from the final billing.',
        'Reservation fee' => 'The reservation fee secures the event date and is non-refundable.',
        'Cancellation' => 'If the Client cancels after signing, payments made for items already fabricated or purchased are non-refundable. The Service Provider will discuss any refund of the remaining amount with the Client.',
        'Venue access' => 'The Client makes sure the Service Provider can enter the venue for ingress and egress on the scheduled dates, including any permits the venue requires.',
        'Damages and loss' => 'Items provided by the Service Provider remain its property unless stated otherwise. The Client is responsible for damage to or loss of these items caused by the Client or the Client\'s guests.',
        'Force majeure' => 'Neither party is liable for delays caused by events beyond its control, such as natural disasters or government restrictions. The parties will agree in good faith on a new date or other arrangement.',
    ],

];
