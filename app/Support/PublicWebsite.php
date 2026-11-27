<?php

namespace App\Support;

use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * What the public pages show, read from Website Content (what the Technical
 * Admin manages). Anything missing falls back to the content the pages had
 * when they were hard-coded, so a page never shows an empty spot.
 *
 * Fixed in the pages (not here): hero headline, section titles, service card
 * titles, the service pages' text, Testimonials, Terms and Privacy text.
 *
 * Cached: every public page reads this, and it only changes when the Technical
 * Admin saves Website Content. forget() clears it right after any change (see
 * AppServiceProvider::configureWebsiteCache), so a change shows immediately.
 */
class PublicWebsite
{
    private const CACHE_PREFIX = 'public-website:';

    /**
     * Bumped by forget(). An instance drops its own memo ($blocks, $library) when
     * this changes, since the same instance can serve several requests (tests,
     * Octane): otherwise a rebuild after forget() would reuse the old rows.
     */
    private static int $generation = 0;

    private int $memoGeneration = 0;

    /** Everything cached here, cleared together by forget(). @return list<string> */
    private static function cacheKeys(): array
    {
        return [
            'contact', 'hero', 'about', 'services', 'carousel', 'works', 'faqs',
            ...array_map(fn (string $key) => "service:{$key}", array_keys(WebsiteDefaults::SERVICE_PAGES)),
        ];
    }

    /** Clears the cached public pages' content: call after any change to Website Content. */
    public static function forget(): void
    {
        self::$generation++;

        foreach (self::cacheKeys() as $key) {
            Cache::forget(self::cacheKey($key));
        }
    }

    /**
     * The key includes when this file and WebsiteDefaults were last edited, so a
     * change to the code (a default text or photo) is picked up without clearing.
     */
    private static function cacheKey(string $key): string
    {
        static $stamp = null;
        $stamp ??= (string) max((int) @filemtime(__FILE__), (int) @filemtime(__DIR__.'/WebsiteDefaults.php'));

        return self::CACHE_PREFIX.$stamp.':'.$key;
    }

    private function cached(string $key, Closure $build): mixed
    {
        if ($this->memoGeneration !== self::$generation) {
            $this->blocks = null;
            $this->library = null;
            $this->memoGeneration = self::$generation;
        }

        return Cache::rememberForever(self::cacheKey($key), $build);
    }

    /** @var Collection<string, WebsiteContent>|null */
    private ?Collection $blocks = null;

    /** @return array<string, string> */
    public function contact(): array
    {
        return $this->cached('contact', function () {
            $saved = json_decode((string) $this->block('contact')?->content, true) ?: [];
            $contact = [];

            foreach (WebsiteDefaults::CONTACT as $key => $default) {
                $value = is_string($saved[$key] ?? null) ? trim($saved[$key]) : null;

                // A social link the admin cleared stays hidden; anything else missing uses the default.
                $contact[$key] = in_array($key, ['facebook', 'instagram'], true) && $value !== null
                    ? $value
                    : ($value ?: $default);
            }

            return $contact;
        });
    }

    /** @return array{url: string, alt: string} */
    public function hero(): array
    {
        return $this->cached('hero', function () {
            return $this->slot('hero', 'hero');
        });
    }

    /** @return array{paragraphs: array<int, string>, photos: array<int, array{url: string, alt: string}>} */
    public function about(): array
    {
        return $this->cached('about', function () {
            $saved = preg_split('/\n\s*\n/', trim((string) $this->block('about')?->content)) ?: [];
            $paragraphs = array_values(array_filter($saved, fn (string $p) => trim($p) !== ''));

            return [
                'paragraphs' => $paragraphs ?: WebsiteDefaults::ABOUT,
                'photos' => [
                    $this->slot('about', 'about_1'),
                    $this->slot('about', 'about_2'),
                    $this->slot('about', 'about_3'),
                ],
            ];
        });
    }

    /** @return array<int, array{title: string, description: string, href: string}> */
    public function serviceCards(): array
    {
        return $this->cached('services', function () {
            $saved = WebsiteContent::query()
                ->where('section', WebsiteContent::SECTION_SERVICES)
                ->whereNull('block_key')
                ->orderBy('sort_order')
                ->limit(3)
                ->pluck('content')
                ->values();

            $defaults = [
                'Professional styling and management for brand activations, mall events, and corporate functions.',
                'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
                'Design and production of customized backdrops, props, and themed event structures.',
            ];

            return collect(array_values(WebsiteDefaults::SERVICE_PAGE_URLS))
                ->map(fn (string $href, int $i) => [
                    'title' => WebsiteDefaults::CARD_TITLES[$i],
                    'description' => trim((string) ($saved[$i] ?? '')) ?: $defaults[$i],
                    'href' => $href,
                ])
                ->all();
        });
    }

    /** The homepage carousel, in order. @return array<int, array{id: int, url: string, title: string, alt: string}> */
    public function carousel(): array
    {
        return $this->cached('carousel', function () {
            return $this->library()
                ->whereNotNull('homepage_order')
                ->sortBy('homepage_order')
                ->map(fn (WebsiteContentImage $photo) => [
                    'id' => $photo->image_id,
                    'url' => $photo->url(),
                    'title' => (string) $photo->title,
                    'alt' => $photo->alt_text ?: (string) $photo->title,
                ])
                ->values()
                ->all();
        });
    }

    /** Every shown Our Works photo. @return array<int, array<string, mixed>> */
    public function works(): array
    {
        return $this->cached('works', function () {
            return $this->library()
                ->map(fn (WebsiteContentImage $photo) => [
                    'id' => $photo->image_id,
                    'url' => $photo->url(),
                    'title' => (string) $photo->title,
                    'caption' => (string) $photo->caption,
                    'category' => $photo->category,
                    'categoryLabel' => WebsiteDefaults::CATEGORIES[$photo->category] ?? '',
                    'alt' => $photo->alt_text ?: (string) $photo->title,
                ])
                ->values()
                ->all();
        });
    }

    /** @return array<string, mixed> */
    public function servicePage(string $key): array
    {
        return $this->cached("service:{$key}", function () use ($key) {
            $category = WebsiteDefaults::SERVICE_PAGES[$key];
            $cards = collect($this->serviceCards())->values();
            $keys = array_keys(WebsiteDefaults::SERVICE_PAGES);

            return [
                'hero' => $this->slot($key, 'hero'),
                'intro' => [$this->slot($key, 'intro_1'), $this->slot($key, 'intro_2')],
                'showcase' => $this->library()
                    ->where('category', $category)
                    ->whereNotNull('showcase_order')
                    ->sortBy('showcase_order')
                    ->map(fn (WebsiteContentImage $photo) => [
                        'id' => $photo->image_id,
                        'url' => $photo->url(),
                        'title' => (string) $photo->title,
                        'caption' => (string) $photo->caption ?: WebsiteDefaults::CATEGORIES[$category],
                        'alt' => $photo->alt_text ?: (string) $photo->title,
                    ])
                    ->values()
                    ->all(),
                // The other two service pages, each with its own photo and card text.
                'moreServices' => collect($keys)
                    ->reject(fn (string $other) => $other === $key)
                    ->map(fn (string $other) => [
                        'title' => $cards[array_search($other, $keys, true)]['title'],
                        'text' => $cards[array_search($other, $keys, true)]['description'],
                        'image' => $this->slot($other, WebsiteDefaults::MORE_SERVICES_PHOTO[$other])['url'],
                        'href' => WebsiteDefaults::SERVICE_PAGE_URLS[$other],
                    ])
                    ->values()
                    ->all(),
            ];
        });
    }

    /** @return array<int, array{id: int, question: string, answer: string}> */
    public function faqs(): array
    {
        return $this->cached('faqs', function () {
            return WebsiteContent::query()
                ->where('section', WebsiteContent::SECTION_FAQ)
                ->orderBy('sort_order')
                ->orderBy('content_id')
                ->get()
                ->map(fn (WebsiteContent $faq) => [
                    'id' => $faq->content_id,
                    'question' => $faq->title,
                    'answer' => (string) $faq->content,
                ])
                ->all();
        });
    }

    /** A slot's photo, or the photo the page had before when the slot is empty. @return array{url: string, alt: string} */
    private function slot(string $block, string $slot): array
    {
        $photo = $this->block($block)?->images->firstWhere('slot', $slot);

        if ($photo !== null) {
            return ['url' => $photo->url(), 'alt' => (string) $photo->alt_text];
        }

        [$path, $alt] = WebsiteDefaults::SLOT_PHOTOS[$block][$slot];

        return ['url' => $path, 'alt' => $alt];
    }

    /** @var Collection<int, WebsiteContentImage>|null */
    private ?Collection $library = null;

    /** Shown Our Works photos, in library order. @return Collection<int, WebsiteContentImage> */
    private function library(): Collection
    {
        return $this->library ??= WebsiteContentImage::query()
            ->library()
            ->where('status', WebsiteContentImage::STATUS_ACTIVE)
            ->orderBy('sort_order')
            ->orderBy('image_id')
            ->get();
    }

    private function block(string $key): ?WebsiteContent
    {
        $this->blocks ??= WebsiteContent::query()
            ->whereIn('block_key', ['contact', ...array_keys(WebsiteDefaults::SLOTS)])
            ->with(['images' => fn ($q) => $q->whereNotNull('slot')->where('status', WebsiteContentImage::STATUS_ACTIVE)])
            ->get()
            ->keyBy('block_key');

        return $this->blocks->get($key);
    }
}
