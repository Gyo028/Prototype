<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * One email design for every notice the Project Manager side sends (fix list, Nov 27):
 * a heading, a short message, a table of details and an optional button.
 * Used for the payment confirmation (#28, #27), the request decision (#13), the dispute
 * resolution (#31), the work summary to the PM (#33) and the other Workflow notices.
 */
class NoticeMail extends Mailable
{
    use Queueable;

    /**
     * @param  array<string, string>  $details  label => value
     * @param  list<string>  $lines  short paragraphs under the heading
     */
    public function __construct(
        public string $subjectLine,
        public string $heading,
        public string $greeting,
        public array $lines = [],
        public array $details = [],
        public ?string $buttonText = null,
        public ?string $buttonUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(view: 'mail.notice');
    }
}