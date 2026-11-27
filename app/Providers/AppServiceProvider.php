<?php

namespace App\Providers;

use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use App\Support\PublicWebsite;
use Carbon\CarbonImmutable;
use Illuminate\Console\Events\CommandFinished;
use Illuminate\Database\Events\MigrationsEnded;
use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureEmails();
        $this->configureWebsiteCache();
    }

    /**
     * The public pages' content is cached (PublicWebsite). Clear it whenever
     * Website Content changes, so the Technical Admin's edits show immediately.
     */
    protected function configureWebsiteCache(): void
    {
        // Saving, adding or deleting a block, photo or FAQ through the models.
        foreach ([WebsiteContent::class, WebsiteContentImage::class] as $model) {
            $model::saved(fn () => PublicWebsite::forget());
            $model::deleted(fn () => PublicWebsite::forget());
        }

        // Any save on the Website Content page, including the carousel and showcase
        // reorders, which update many rows at once without model events.
        Event::listen(RequestHandled::class, function (RequestHandled $event) {
            if (! $event->request->isMethodSafe() && $event->request->routeIs('technical-admin.website-content.*')) {
                PublicWebsite::forget();
            }
        });

        // Migrations, seeding and the photo move write to the tables directly.
        Event::listen(MigrationsEnded::class, fn () => PublicWebsite::forget());
        Event::listen(CommandFinished::class, function (CommandFinished $event) {
            if (in_array($event->command, ['db:seed', 'website:photos-to-storage'], true)) {
                PublicWebsite::forget();
            }
        });
    }

    /**
     * The verification email sent after registering (and on "Resend"): branded
     * with the GR3AT A's logo and a gold button (resources/views/mail).
     */
    protected function configureEmails(): void
    {
        // The link works without logging in (EmailVerificationController::verify).
        VerifyEmail::createUrlUsing(fn (object $notifiable) => URL::temporarySignedRoute(
            'verification.verify.guest',
            Carbon::now()->addMinutes((int) config('auth.verification.expire', 60)),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())],
        ));

        // A line in storage/logs/laravel.log for every verification email sent, to trace delivery.
        Event::listen(NotificationSent::class, function (NotificationSent $event) {
            if ($event->notification instanceof VerifyEmail && $event->channel === 'mail') {
                Log::info('Verification email sent to '.$event->notifiable->email.' via '.config('mail.default'));
            }
        });

        VerifyEmail::toMailUsing(fn (object $notifiable, string $url) => (new MailMessage)
            ->subject('Verify your email · '.config('app.name'))
            ->view(['html' => 'mail.verify-email', 'text' => 'mail.verify-email-text'], [
                'url' => $url,
                'name' => $notifiable->name ?? 'there',
                'expires' => config('auth.verification.expire', 60),
            ]));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
