<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Models\WebsiteContent;
use App\Models\WebsiteContentImage;
use App\Services\WebsitePhotos;
use App\Support\WebsiteDefaults;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Technical Admin > Website Content > Our Works.
 *
 * One shared photo library. Each photo has a title, an optional short caption
 * and one of the three service categories. From the library the admin picks:
 *  - up to 10 photos for the homepage carousel, in order,
 *  - 4 photos for each service page showcase (from that page's category).
 *
 * A photo on the carousel or in a showcase cannot be hidden, deleted or moved
 * to another category: it is taken off there first, so the pages never lose
 * a photo they show. Only a hidden photo can be deleted for good.
 */
class WorkPhotoController extends Controller
{
    public function store(Request $request, WebsitePhotos $photos): RedirectResponse
    {
        $data = $this->validated($request, photoRequired: true);

        if ($request->boolean('add_to_carousel') && $this->carouselCount() >= WebsiteDefaults::CAROUSEL_MAX) {
            throw ValidationException::withMessages([
                'add_to_carousel' => 'The carousel already has '.WebsiteDefaults::CAROUSEL_MAX.' photos. Remove one first.',
            ]);
        }

        $paths = $photos->store($request->file('photo'), 'photo');

        DB::transaction(function () use ($data, $paths, $request) {
            $works = $this->worksBlock();

            $works->images()->create([
                'file_path' => $paths['file_path'],
                'thumb_path' => $paths['thumb_path'],
                'title' => $data['title'],
                'caption' => $data['caption'],
                'category' => $data['category'],
                'alt_text' => $data['alt_text'] ?: $data['title'],
                'homepage_order' => $request->boolean('add_to_carousel') ? $this->carouselCount() + 1 : null,
                'sort_order' => (int) WebsiteContentImage::query()->library()->max('sort_order') + 1,
                'status' => WebsiteContentImage::STATUS_ACTIVE,
            ]);

            $works->forceFill(['updated_by' => auth()->id()])->touch();
        });

        return to_route('technical-admin.website-content');
    }

    /** Edits the details and, when a new file is sent, replaces the photo. */
    public function update(Request $request, WebsitePhotos $photos, WebsiteContentImage $photo): RedirectResponse
    {
        $this->ensureLibrary($photo);

        $data = $this->validated($request, photoRequired: false);

        if ($photo->showcase_order !== null && $data['category'] !== $photo->category) {
            throw ValidationException::withMessages([
                'category' => 'This photo is in the '.WebsiteDefaults::CATEGORIES[$photo->category].' showcase. Replace it there before changing its category.',
            ]);
        }

        $paths = $request->hasFile('photo') ? $photos->store($request->file('photo'), 'photo') : null;
        $old = $paths ? [$photo->file_path, $photo->thumb_path] : [];

        $photo->fill([
            'title' => $data['title'],
            'caption' => $data['caption'],
            'category' => $data['category'],
            'alt_text' => $data['alt_text'] ?: $data['title'],
            ...($paths ?? []),
        ])->save();

        $photos->delete(...$old);

        return to_route('technical-admin.website-content');
    }

    /** Hides or shows a photo. A photo in use stays visible. */
    public function status(Request $request, WebsiteContentImage $photo): RedirectResponse
    {
        $this->ensureLibrary($photo);

        $status = $request->validate([
            'status' => ['required', Rule::in([WebsiteContentImage::STATUS_ACTIVE, WebsiteContentImage::STATUS_INACTIVE])],
        ])['status'];

        if ($status === WebsiteContentImage::STATUS_INACTIVE) {
            $this->ensureNotInUse($photo, 'hidden');
        }

        $photo->update(['status' => $status]);

        return to_route('technical-admin.website-content');
    }

    /** Deletes a hidden photo that is not used anywhere, with its files. */
    public function destroy(WebsitePhotos $photos, WebsiteContentImage $photo): RedirectResponse
    {
        $this->ensureLibrary($photo);
        $this->ensureNotInUse($photo, 'deleted');

        if ($photo->status !== WebsiteContentImage::STATUS_INACTIVE) {
            throw ValidationException::withMessages(['photo' => 'Hide the photo first. Only hidden photos can be deleted.']);
        }

        $files = [$photo->file_path, $photo->thumb_path];
        $photo->delete();
        $photos->delete(...$files);

        return to_route('technical-admin.website-content');
    }

    /** Saves the homepage carousel: the photo ids in order (1 to 10 photos). */
    public function carousel(Request $request): RedirectResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:'.WebsiteDefaults::CAROUSEL_MAX],
            'ids.*' => ['integer', 'distinct'],
        ], [
            'ids.required' => 'Keep at least one photo on the carousel.',
            'ids.min' => 'Keep at least one photo on the carousel.',
            'ids.max' => 'The carousel shows up to :max photos.',
        ])['ids'];

        $this->ensureActiveLibraryPhotos($ids);

        DB::transaction(function () use ($ids) {
            WebsiteContentImage::query()->library()->whereNotNull('homepage_order')->update(['homepage_order' => null]);

            foreach (array_values($ids) as $i => $id) {
                WebsiteContentImage::whereKey($id)->update(['homepage_order' => $i + 1]);
            }

            $this->worksBlock()->forceFill(['updated_by' => auth()->id()])->touch();
        });

        return to_route('technical-admin.website-content');
    }

    /** Saves a service page showcase: exactly 4 photo ids from that page's category, in order. */
    public function showcase(Request $request, string $page): RedirectResponse
    {
        $category = WebsiteDefaults::SERVICE_PAGES[$page] ?? null;
        abort_if($category === null, 404);

        $ids = $request->validate([
            'ids' => ['required', 'array', 'size:'.WebsiteDefaults::SHOWCASE_SIZE],
            'ids.*' => ['integer', 'distinct'],
        ], [
            'ids.required' => 'Pick '.WebsiteDefaults::SHOWCASE_SIZE.' photos for the showcase.',
            'ids.size' => 'Pick exactly :size photos for the showcase.',
        ])['ids'];

        $this->ensureActiveLibraryPhotos($ids, $category);

        DB::transaction(function () use ($ids, $category, $page) {
            WebsiteContentImage::query()->library()->where('category', $category)->update(['showcase_order' => null]);

            foreach (array_values($ids) as $i => $id) {
                WebsiteContentImage::whereKey($id)->update(['showcase_order' => $i + 1]);
            }

            WebsiteContent::where('block_key', $page)->first()?->forceFill(['updated_by' => auth()->id()])->touch();
        });

        return to_route('technical-admin.website-content');
    }

    /** @return array{title: string, caption: ?string, category: string, alt_text: ?string} */
    private function validated(Request $request, bool $photoRequired): array
    {
        $request->merge([
            'title' => $this->oneLine($request->input('title')),
            'caption' => $this->oneLine($request->input('caption')),
            'alt_text' => $this->oneLine($request->input('alt_text')),
        ]);

        $data = $request->validate([
            'photo' => [$photoRequired ? 'required' : 'nullable', ...WebsitePhotos::RULES],
            'title' => ['required', 'string', 'max:30'],
            'caption' => ['nullable', 'string', 'max:32'],
            'category' => ['required', Rule::in(array_keys(WebsiteDefaults::CATEGORIES))],
            'alt_text' => ['nullable', 'string', 'max:150'],
        ], [
            'photo.required' => 'Choose a photo to upload.',
            'photo.mimes' => 'Only JPG, PNG or WEBP photos are allowed.',
            'photo.mimetypes' => 'Only JPG, PNG or WEBP photos are allowed.',
            'photo.max' => 'The photo must be 5 MB or smaller.',
            'title.required' => 'Title is required.',
            'title.max' => 'Keep the title within :max characters so it fits on the photo.',
            'caption.max' => 'Keep the caption within :max characters so it fits on the photo.',
            'category.required' => 'Choose a category.',
            'category.in' => 'Choose one of the three categories.',
        ]);

        return [
            'title' => $data['title'],
            'caption' => $data['caption'] ?? null,
            'category' => $data['category'],
            'alt_text' => $data['alt_text'] ?? null,
        ];
    }

    /** @param  array<int, int>  $ids */
    private function ensureActiveLibraryPhotos(array $ids, ?string $category = null): void
    {
        $found = WebsiteContentImage::query()
            ->library()
            ->whereKey($ids)
            ->where('status', WebsiteContentImage::STATUS_ACTIVE)
            ->when($category, fn ($q) => $q->where('category', $category))
            ->count();

        if ($found !== count($ids)) {
            throw ValidationException::withMessages([
                'ids' => $category
                    ? 'Pick only shown photos from the '.WebsiteDefaults::CATEGORIES[$category].' category.'
                    : 'Pick only shown Our Works photos.',
            ]);
        }
    }

    private function ensureNotInUse(WebsiteContentImage $photo, string $action): void
    {
        $places = array_filter([
            $photo->homepage_order !== null ? 'the homepage carousel' : null,
            $photo->showcase_order !== null ? 'the '.WebsiteDefaults::CATEGORIES[$photo->category].' showcase' : null,
        ]);

        if ($places !== []) {
            throw ValidationException::withMessages([
                'photo' => 'This photo is on '.implode(' and ', $places).". Take it off there before it can be {$action}.",
            ]);
        }
    }

    /** Fixed slot photos (hero, About Us, ...) are not part of the library. */
    private function ensureLibrary(WebsiteContentImage $photo): void
    {
        abort_unless($photo->slot === null && $photo->content?->block_key === 'works', 404);
    }

    private function carouselCount(): int
    {
        return WebsiteContentImage::query()->library()->whereNotNull('homepage_order')->count();
    }

    private function worksBlock(): WebsiteContent
    {
        return WebsiteContent::firstOrCreate(
            ['block_key' => 'works'],
            ['section' => WebsiteContent::SECTION_GALLERY, 'title' => 'Our Works', 'sort_order' => 1],
        );
    }

    private function oneLine(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $text = trim((string) preg_replace('/\s+/u', ' ', $value));

        return $text === '' ? null : $text;
    }
}
