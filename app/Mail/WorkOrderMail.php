<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Backlog #33: the work order emailed to the Fabrication / Installation Head.
 * Holds the project details, the phase's schedule and the Project Manager's instructions.
 */
class WorkOrderMail extends Mailable
{
    use Queueable;

    /** @param  array<string, string>  $order */
    public function __construct(public array $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Work order {$this->order['code']} · {$this->order['phase']} · {$this->order['project']}");
    }

    public function content(): Content
    {
        return new Content(view: 'mail.work-order', with: ['order' => $this->order]);
    }
}