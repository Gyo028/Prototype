<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use App\Support\WebsiteDefaults;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technical Admin > Website Content.
 *
 * Shows every section and saves the text blocks: About Us, the service card
 * descriptions and Contact & Footer. Photos are saved by
 * WebsitePhotoSlotController (fixed slots) and WorkPhotoController (Our Works
 * library, carousel and showcases); FAQ entries by FaqController.
 *
 * Text that could break the page layout is fixed in the page and not edited
 * here: the hero headline and subheadline, the section titles and the
 * service card titles.
 */
class WebsiteContentController extends Controller
{
    private const URL_REGEX = '/^https?:\/\/\S+\.\S+$/';

    /** Character limits that keep the landing page layout as designed. */
    public const LIMITS = [
        'about_first' => 180,
        'about_second' => 420,
        'card_min' => 50,
        'card_max' => 110,
    ];

    public function index(): Response
    {
        $blocks = WebsiteContent::query()
            ->whereIn('block_key', array_keys(WebsiteDefaults::SLOTS))
            ->with(['images' => fn ($q) => $q->whereNotNull('slot')])
            ->get()
            ->keyBy('block_key');

        $paragraphs = preg_split('/\n\s*\n/', trim((string) $blocks->get('about')?->content)) ?: [];

        $cards = WebsiteContent::query()
            ->where('section', WebsiteContent::SECTION_SERVICES)
            ->whereNull('block_key')
            ->orderBy('sort_order')
            ->limit(3)
            ->get()
            ->values()
            ->map(fn (WebsiteContent $card, int $i) => [
                'title' => WebsiteDefaults::CARD_TITLES[$i] ?? $card->title,
                'description' => (string) $card->content,
            ])
            ->all();

        $library = WebsiteContentImage::query()
            ->library()
            ->orderBy('sort_order')
            ->orderBy('image_id')
            ->get();

        $contact = array_merge(
            ['phone' => '', 'email' => '', 'address' => '', 'facebook' => '', 'instagram' => '', 'copyright' => ''],
            json_decode((string) WebsiteContent::where('block_key', 'contact')->value('content'), true) ?: [],
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
            'hero' => [
                'photos' => $this->slotPhotos($blocks->get('hero'), 'hero'),
            ],
            'about' => [
                'first' => $paragraphs[0] ?? '',
                'second' => implode(' ', array_slice($paragraphs, 1)),
                'photos' => $this->slotPhotos($blocks->get('about'), 'about'),
            ],
            'services' => [
                'cards' => $cards,
            ],
            'servicePages' => collect(WebsiteDefaults::SERVICE_PAGES)
                ->map(fn (string $category, string $key) => [
                    'key' => $key,
                    'title' => WebsiteDefaults::CATEGORIES[$category],
                    'category' => $category,
                    'photos' => $this->slotPhotos($blocks->get($key), $key),
                    'showcase' => $library
                        ->where('category', $category)
                        ->whereNotNull('showcase_order')
                        ->sortBy('showcase_order')
                        ->pluck('image_id')
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all(),
            'works' => $library->map(fn (WebsiteContentImage $photo) => [
                'id' => $photo->image_id,
                'url' => $photo->url(),
                'thumb' => $photo->thumbUrl(),
                'title' => (string) $photo->title,
                'caption' => (string) $photo->caption,
                'category' => $photo->category,
                'alt' => (string) $photo->alt_text,
                'status' => $photo->status,
                'homepageOrder' => $photo->homepage_order,
                'showcaseOrder' => $photo->showcase_order,
            ])->values()->all(),
            'contact' => $contact,
            'faqs' => $faqs,
            'updated' => [
                'hero' => $this->updatedAgo(['hero']),
                'about' => $this->updatedAgo(['about']),
                'services' => $this->ago(
                    WebsiteContent::where('section', WebsiteContent::SECTION_SERVICES)
                        ->where(fn ($q) => $q->whereNull('block_key')->orWhere('block_key', 'services'))
                        ->max('updated_at'),
                ),
                'pages' => $this->updatedAgo(array_keys(WebsiteDefaults::SERVICE_PAGES)),
                'works' => $this->updatedAgo(['works']),
                'contact' => $this->updatedAgo(['contact']),
                'faq' => $this->ago(WebsiteContent::where('section', WebsiteContent::SECTION_FAQ)->max('updated_at')),
            ],
        ]);
    }

    /** About Us: the two paragraphs. The section title is fixed. */
    public function updateAbout(Request $request): RedirectResponse
    {
        $request->merge([
            'first' => $this->oneLine($request->input('first')),
            'second' => $this->oneLine($request->input('second')),
        ]);

        $data = $request->validate([
            'first' => ['required', 'string', 'max:'.self::LIMITS['about_first']],
            'second' => ['required', 'string', 'max:'.self::LIMITS['about_second']],
        ], [
            'first.required' => 'The first paragraph is required.',
            'first.max' => 'Keep the first paragraph within :max characters so it fits beside the photos.',
            'second.required' => 'The second paragraph is required.',
            'second.max' => 'Keep the second paragraph within :max characters so it fits beside the photos.',
        ]);

        $about = WebsiteContent::where('block_key', 'about')->first();

        $this->saveBlock(
            'about',
            WebsiteContent::SECTION_HOMEPAGE,
            2,
            $about?->title ?? 'About Us',
            $data['first']."\n\n".$data['second'],
        );

        return to_route('technical-admin.website-content');
    }

    /** Our Services: the three card descriptions. The titles are fixed. */
    public function updateServices(Request $request): RedirectResponse
    {
        $request->merge([
            'cards' => collect((array) $request->input('cards'))
                ->map(fn ($card) => ['description' => $this->oneLine(is_array($card) ? ($card['description'] ?? null) : null)])
                ->all(),
        ]);

        $data = $request->validate([
            'cards' => ['required', 'array', 'size:3'],
            'cards.*.description' => ['required', 'string', 'min:'.self::LIMITS['card_min'], 'max:'.self::LIMITS['card_max']],
        ], [
            'cards.*.description.required' => 'Card description is required.',
            'cards.*.description.min' => 'Write at least :min characters so the three cards stay balanced.',
            'cards.*.description.max' => 'Keep the description within :max characters so the three cards stay balanced.',
        ]);

        DB::transaction(function () use ($data) {
            if (! WebsiteContent::where('block_key', 'services')->exists()) {
                $this->saveBlock('services', WebsiteContent::SECTION_SERVICES, 0, 'Our Services', null);
            }

            foreach (array_values($data['cards']) as $i => $card) {
                $row = WebsiteContent::query()
                    ->where('section', WebsiteContent::SECTION_SERVICES)
                    ->whereNull('block_key')
                    ->where('sort_order', $i + 1)
                    ->first() ?? new WebsiteContent([
                        'section' => WebsiteContent::SECTION_SERVICES,
                        'sort_order' => $i + 1,
                        'title' => WebsiteDefaults::CARD_TITLES[$i],
                    ]);

                $row->fill([
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

    /**
     * The block's slot photos, one entry per slot (null when empty).
     *
     * @return array<string, array{url: string, alt: string}|null>
     */
    private function slotPhotos(?WebsiteContent $block, string $key): array
    {
        return collect(WebsiteDefaults::SLOTS[$key])
            ->map(function (string $kind, string $slot) use ($block) {
                $photo = $block?->images->firstWhere('slot', $slot);

                return $photo ? ['url' => $photo->url(), 'alt' => (string) $photo->alt_text] : null;
            })
            ->all();
    }

    /** Trims the text and turns line breaks and repeated spaces into single spaces. */
    private function oneLine(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $text = trim((string) preg_replace('/\s+/u', ' ', $value));

        return $text === '' ? null : $text;
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

    /** When the blocks or any of their photos last changed. */
    private function updatedAgo(array $keys): ?string
    {
        $ids = WebsiteContent::whereIn('block_key', $keys)->pluck('content_id');

        return $this->ago(
            WebsiteContent::whereIn('content_id', $ids)->max('updated_at'),
            WebsiteContentImage::whereIn('content_id', $ids)->max('updated_at'),
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
