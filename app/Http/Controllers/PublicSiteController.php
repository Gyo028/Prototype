<?php

namespace App\Http\Controllers;

use App\Support\PublicWebsite;
use App\Support\WebsiteDefaults;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The public website. Every page gets the Contact & Footer details (footer,
 * phone buttons, Terms and Privacy contact block); the rest comes from
 * Website Content in the Technical Admin.
 */
class PublicSiteController extends Controller
{
    public function __construct(private readonly PublicWebsite $site) {}

    public function landing(): Response
    {
        return $this->page('public/landing', [
            'hero' => $this->site->hero(),
            'about' => $this->site->about(),
            'services' => $this->site->serviceCards(),
            'carousel' => $this->site->carousel(),
        ]);
    }

    public function ourWorks(): Response
    {
        return $this->page('public/our-works', [
            'works' => $this->site->works(),
            'categories' => collect(WebsiteDefaults::CATEGORIES)
                ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
                ->values()
                ->all(),
        ]);
    }

    public function corporateEvents(): Response
    {
        return $this->page('public/corporate-events', $this->site->servicePage('svc_corporate'));
    }

    public function specialOccasions(): Response
    {
        return $this->page('public/special-occasions', $this->site->servicePage('svc_special'));
    }

    public function customProjects(): Response
    {
        return $this->page('public/custom-fabrication', $this->site->servicePage('svc_custom'));
    }

    public function faq(): Response
    {
        return $this->page('public/faq', ['faqs' => $this->site->faqs()]);
    }

    public function terms(): Response
    {
        return $this->page('public/terms');
    }

    public function privacy(): Response
    {
        return $this->page('public/privacy');
    }

    /** @param  array<string, mixed>  $props */
    private function page(string $component, array $props = []): Response
    {
        return Inertia::render($component, ['contact' => $this->site->contact(), ...$props]);
    }
}
