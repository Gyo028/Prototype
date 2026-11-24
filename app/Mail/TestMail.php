<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** A short branded email to check the mail settings (php artisan mail:test). */
class TestMail extends Mailable
{
    use Queueable;

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Test email · '.config('app.name'));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.test',
            with: [
                'mailer' => config('mail.default'),
                'sentAt' => now(config('app.timezone'))->format('M j, Y g:i A'),
            ],
        );
    }
}
