<?php

namespace App\Console\Commands;

use App\Mail\TestMail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Sends a test email to check the mail settings in .env:
 *
 *   php artisan mail:test you@example.com
 */
class SendTestMail extends Command
{
    protected $signature = 'mail:test {to : The email address to send it to}';

    protected $description = 'Send a test email to check the mail settings';

    public function handle(): int
    {
        $to = (string) $this->argument('to');

        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->error("\"{$to}\" is not an email address.");

            return self::FAILURE;
        }

        $mailer = (string) config('mail.default');

        if ($mailer === 'log') {
            $this->warn('MAIL_MAILER is "log": the email is written to storage/logs/laravel.log, not sent.');
        }

        try {
            Mail::to($to)->send(new TestMail);
        } catch (Throwable $e) {
            while ($e->getPrevious() !== null) {
                $e = $e->getPrevious();
            }

            $this->error('Could not send: '.$e->getMessage());
            $this->line('Check MAIL_* in .env (Gmail: an App Password, not your normal password), then run php artisan config:clear.');

            return self::FAILURE;
        }

        $this->info("Sent to {$to} through \"{$mailer}\". Check the inbox (and Spam).");

        return self::SUCCESS;
    }
}
