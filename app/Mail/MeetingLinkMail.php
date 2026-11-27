<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Adviser revision G3: the online consultation link emailed to the customer. */
class MeetingLinkMail extends Mailable
{
    use Queueable;

    /** @param  array<string, string>  $meeting */
    public function __construct(public array $meeting) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your online consultation link · {$this->meeting['project']}");
    }

    public function content(): Content
    {
        return new Content(view: 'mail.meeting-link', with: ['meeting' => $this->meeting]);
    }
}