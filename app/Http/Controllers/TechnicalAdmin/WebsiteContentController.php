<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technical Admin > Website Content.
 *
 * Handles the fixed blocks: About Us, Our Services and Contact & Footer.
 * (FAQ entries are in FaqController. The Hero and Our Works photos come later.)
 */
class WebsiteContentController extends Controller
{
    private const URL_REGEX = '/^https?:\/\/\S+\.\S+$/';

    public function index(): Response
    {
        $about = $this->block('about');
        $services = $this->block('services');

        $cards = WebsiteContent::query()
            ->where('section', WebsiteContent::SECTION_SERVICES)
            ->whereNull('block_key')
            ->orderBy('sort_order')
            ->limit(3)
            ->get()
            ->map(fn (WebsiteContent $card) => [
                'title' => $card->title,
                'description' => (string) $card->content,
            ])
            ->all();

        $contact = array_merge(
            ['phone' => '', 'email' => '', 'address' => '', 'facebook' => '', 'instagram' => '', 'copyright' => ''],
            json_decode((string) $this->block('contact')?->content, true) ?: [],
        );

        $faqs = WebsiteContent::query()
            ->where('section', WebsiteContent::SECTION_FAQ)
            ->orderBy('sort_order')
            ->orderBy('content_id')
            ->get()
            ->map(fn (WebsiteContent $faq) => [
                'id' => $faq->content_id,
                'question' => $faq->title,
                'answer' => (string) $faq->content,
            ]);

        return Inertia::render('technical-admin/website-content', [
            'about' => [
                'title' => $about?->title ?? 'About Us',
                'content' => (string) $about?->content,
            ],
            'services' => [
                'title' => $services?->title ?? 'Our Services',
                'intro' => (string) $services?->content,
                'cards' => $cards,
            ],
            'contact' => $contact,
            'faqs' => $faqs,
            'updated' => [
                'hero' => $this->ago(WebsiteContent::where('block_key', 'hero')->max('updated_at')),
                'about' => $this->ago(WebsiteContent::where('block_key', 'about')->max('updated_at')),
                'services' => $this->ago(WebsiteContent::where('section', WebsiteContent::SECTION_SERVICES)->max('updated_at')),
                'works' => $this->ago(
                    WebsiteContent::where('section', WebsiteContent::SECTION_GALLERY)->max('updated_at'),
                    WebsiteContentImage::max('updated_at'),
                ),
                'contact' => $this->ago(WebsiteContent::where('block_key', 'contact')->max('updated_at')),
                'faq' => $this->ago(WebsiteContent::where('section', WebsiteContent::SECTION_FAQ)->max('updated_at')),
            ],
        ]);
    }

    public function updateAbout(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:40'],
            'content' => ['required', 'string', 'max:1500'],
        ], [
            'title.required' => 'Section title is required.',
            'content.required' => 'Content is required.',
        ]);

        $this->saveBlock('about', WebsiteContent::SECTION_HOMEPAGE, 2, $data['title'], $data['content']);

        return to_route('technical-admin.website-content');
    }

    public function updateServices(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:40'],
            'intro' => ['nullable', 'string', 'max:200'],
            'cards' => ['required', 'array', 'size:3'],
            'cards.*.title' => ['required', 'string', 'max:40'],
            'cards.*.description' => ['required', 'string', 'max:150'],
        ], [
            'title.required' => 'Section title is required.',
            'cards.*.title.required' => 'Card title is required.',
            'cards.*.description.required' => 'Card description is required.',
        ]);

        DB::transaction(function () use ($data) {
            $this->saveBlock('services', WebsiteContent::SECTION_SERVICES, 0, $data['title'], $data['intro'] ?? null);

            foreach (array_values($data['cards']) as $i => $card) {
                $row = WebsiteContent::query()
                    ->where('section', WebsiteContent::SECTION_SERVICES)
                    ->whereNull('block_key')
                    ->where('sort_order', $i + 1)
                    ->first() ?? new WebsiteContent(['section' => WebsiteContent::SECTION_SERVICES, 'sort_order' => $i + 1]);

                $row->fill([
                    'title' => $card['title'],
                    'content' => $card['description'],
                    'updated_by' => auth()->id(),
                ])->save();
            }
        });

        return to_route('technical-admin.website-content');
    }

    public function updateContact(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'phone' => [
                'required', 'string', 'max:30',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (strlen(preg_replace('/\D/', '', $value)) < 7) {
                        $fail('Enter a valid phone number.');
                    }
                },
            ],
            'email' => ['required', 'string', 'email', 'max:100'],
            'address' => ['required', 'string', 'max:150'],
            'facebook' => ['nullable', 'string', 'max:200', 'regex:'.self::URL_REGEX],
            'instagram' => ['nullable', 'string', 'max:200', 'regex:'.self::URL_REGEX],
            'copyright' => ['required', 'string', 'max:150'],
        ], [
            'phone.required' => 'Phone number is required.',
            'email.required' => 'Email is required.',
            'email.email' => 'Enter a valid email address.',
            'address.required' => 'Address is required.',
            'facebook.regex' => 'Enter a full link starting with https://',
            'instagram.regex' => 'Enter a full link starting with https://',
            'copyright.required' => 'Copyright line is required.',
        ]);

        $this->saveBlock('contact', WebsiteContent::SECTION_HOMEPAGE, 3, 'Contact & Footer', json_encode([
            'phone' => $data['phone'],
            'email' => $data['email'],
            'address' => $data['address'],
            'facebook' => $data['facebook'] ?? '',
            'instagram' => $data['instagram'] ?? '',
            'copyright' => $data['copyright'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return to_route('technical-admin.website-content');
    }

    private function block(string $key): ?WebsiteContent
    {
        return WebsiteContent::where('block_key', $key)->first();
    }

    private function saveBlock(string $key, string $section, int $order, string $title, ?string $content): WebsiteContent
    {
        return WebsiteContent::updateOrCreate(
            ['block_key' => $key],
            [
                'section' => $section,
                'title' => $title,
                'content' => $content,
                'sort_order' => $order,
                'updated_by' => auth()->id(),
            ],
        );
    }

    private function ago(?string ...$timestamps): ?string
    {
        return collect($timestamps)
            ->filter()
            ->map(fn (string $time) => Carbon::parse($time))
            ->max()
            ?->diffForHumans();
    }
}