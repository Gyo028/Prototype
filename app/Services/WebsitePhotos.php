<?php

namespace App\Services;

use App\Models\WebsiteContentImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Turns a photo the Technical Admin uploads into the files the website uses.
 *
 * Every upload (JPG, PNG or WEBP, up to 5 MB) is:
 *  - turned the right way up (phone photos carry their rotation in EXIF),
 *  - checked for shape and size, so it fits its place on the page,
 *  - scaled down to the largest size the page shows,
 *  - converted to WebP (quality 80); the original is not kept, and the
 *    re-encoding drops the photo's EXIF data (camera, GPS location),
 *  - saved under a random name, with a 400 px thumbnail for admin lists.
 *
 * Needs the intervention/image package (^3) and PHP's GD with WebP support.
 */
class WebsitePhotos
{
    /** Upload rules, before conversion. */
    public const RULES = ['file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120'];

    /** Kinds of photo: the largest size saved and the smallest accepted. */
    public const KINDS = [
        // Wide hero banners: landscape, saved up to 1920 px wide.
        'banner' => ['save' => 1920, 'min' => 900],
        // Every other photo: saved up to 1600 px on the long side.
        'photo' => ['save' => 1600, 'min' => 700],
    ];

    private const THUMB = 400;

    /**
     * Bigger images are refused before they are opened. An opened photo needs
     * about 4-5 bytes per pixel in memory, so a 40 MP photo uses ~200 MB.
     */
    private const MAX_PIXELS_PER_SIDE = 8000;

    private const MAX_MEGAPIXELS = 40;

    /** Memory allowed while one photo is converted (PHP's default 128M is too little for phone photos). */
    private const MEMORY_LIMIT = '512M';

    private const QUALITY = 80;

    /**
     * Converts and saves the upload. Throws a validation error on $field when
     * the photo does not fit.
     *
     * @return array{file_path: string, thumb_path: string}
     */
    public function store(UploadedFile $file, string $kind, string $field = 'photo'): array
    {
        $limits = self::KINDS[$kind];
        $source = (string) $file->getRealPath();

        // Reads only the header, so a huge image is refused before it is decoded.
        $header = @getimagesize($source);

        if ($header === false) {
            $this->fail($field, 'This file is not a readable image.');
        }

        if (
            $header[0] > self::MAX_PIXELS_PER_SIDE
            || $header[1] > self::MAX_PIXELS_PER_SIDE
            || $header[0] * $header[1] > self::MAX_MEGAPIXELS * 1_000_000
        ) {
            $this->fail($field, 'This photo has too many pixels. Use one under '.self::MAX_MEGAPIXELS.' megapixels (for example 6000 × 4000).');
        }

        $this->raiseMemoryLimit();

        try {
            // read() also turns the photo the right way up.
            $image = (new ImageManager(new Driver))->read($source);
        } catch (Throwable $e) {
            report($e);
            $this->fail($field, 'This photo could not be opened. Try another JPG, PNG or WEBP file.');
        }

        $width = $image->width();
        $height = $image->height();

        if ($kind === 'banner') {
            if ($width <= $height) {
                $this->fail($field, 'Use a landscape (wide) photo for the banner.');
            }
            if ($width < $limits['min']) {
                $this->fail($field, "The banner photo needs to be at least {$limits['min']} pixels wide. This one is {$width}.");
            }
        } elseif (max($width, $height) < $limits['min']) {
            $longest = max($width, $height);
            $this->fail($field, "The photo needs to be at least {$limits['min']} pixels on its longest side. This one is {$longest}.");
        }

        try {
            $kind === 'banner'
                ? $image->scaleDown(width: $limits['save'])
                : $image->scaleDown(width: $limits['save'], height: $limits['save']);
            $photo = (string) $image->toWebp(quality: self::QUALITY);

            $image->scaleDown(width: self::THUMB, height: self::THUMB);
            $thumb = (string) $image->toWebp(quality: self::QUALITY);
        } catch (Throwable $e) {
            report($e);
            $this->fail($field, 'This photo could not be converted. Try another JPG, PNG or WEBP file.');
        }

        $name = Str::uuid()->toString();
        $paths = [
            'file_path' => "website/{$name}.webp",
            'thumb_path' => "website/thumbs/{$name}.webp",
        ];

        $disk = Storage::disk(WebsiteContentImage::disk());
        $disk->put($paths['file_path'], $photo, 'public');
        $disk->put($paths['thumb_path'], $thumb, 'public');

        return $paths;
    }

    /** Removes uploaded files. App files (paths starting with "/") are never removed. */
    public function delete(?string ...$paths): void
    {
        $uploaded = array_values(array_filter(
            $paths,
            fn (?string $path) => $path !== null && $path !== '' && ! str_starts_with($path, '/'),
        ));

        if ($uploaded !== []) {
            Storage::disk(WebsiteContentImage::disk())->delete($uploaded);
        }
    }

    /** Raises PHP's memory limit for this request only, never lowers it. */
    private function raiseMemoryLimit(): void
    {
        $current = ini_get('memory_limit');

        if ($current === '-1' || $current === false) {
            return;
        }

        $bytes = fn (string $value) => (int) $value * match (strtoupper(substr(trim($value), -1))) {
            'G' => 1024 ** 3,
            'M' => 1024 ** 2,
            'K' => 1024,
            default => 1,
        };

        if ($bytes($current) < $bytes(self::MEMORY_LIMIT)) {
            @ini_set('memory_limit', self::MEMORY_LIMIT);
        }
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
