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

/**
 * Technical Admin > Website Content: the fixed photo slots.
 *
 * Hero banner, the three About Us collage photos, and each service page's
 * hero banner and intro photo pair. Uploading replaces the slot's photo
 * right away; the old uploaded file is removed.
 */
class WebsitePhotoSlotController extends Controller
{
    public function update(Request $request, WebsitePhotos $photos, string $block, string $slot): RedirectResponse
    {
        $kind = WebsiteDefaults::SLOTS[$block][$slot] ?? null;
        abort_if($kind === null, 404);

        $data = $request->validate([
            'photo' => ['required', ...WebsitePhotos::RULES],
            'alt_text' => ['nullable', 'string', 'max:150'],
        ], [
            'photo.required' => 'Choose a photo to upload.',
            'photo.mimes' => 'Only JPG, PNG or WEBP photos are allowed.',
            'photo.mimetypes' => 'Only JPG, PNG or WEBP photos are allowed.',
            'photo.max' => 'The photo must be 5 MB or smaller.',
        ]);

        $paths = $photos->store($request->file('photo'), $kind);

        $old = DB::transaction(function () use ($block, $slot, $paths, $data) {
            $content = WebsiteContent::where('block_key', $block)->first();

            if ($content === null) {
                // A block that was never seeded; the service pages sit in the services section.
                $content = WebsiteContent::create([
                    'section' => $block === 'about' || $block === 'hero' ? WebsiteContent::SECTION_HOMEPAGE : WebsiteContent::SECTION_SERVICES,
                    'block_key' => $block,
                    'title' => $block,
                ]);
            }

            $photo = WebsiteContentImage::firstOrNew(['content_id' => $content->content_id, 'slot' => $slot]);
            $old = $photo->exists ? [$photo->file_path, $photo->thumb_path] : [];

            $photo->fill([
                'file_path' => $paths['file_path'],
                'thumb_path' => $paths['thumb_path'],
                'alt_text' => $data['alt_text'] ?? $photo->alt_text,
                'status' => WebsiteContentImage::STATUS_ACTIVE,
            ])->save();

            $content->forceFill(['updated_by' => auth()->id()])->touch();

            return $old;
        });

        $photos->delete(...$old);

        return to_route('technical-admin.website-content');
    }
}
