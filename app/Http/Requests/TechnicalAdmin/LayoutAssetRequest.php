<?php

namespace App\Http\Requests\TechnicalAdmin;

use App\Models\AssetVariant;
use App\Models\LayoutAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Used for both adding and editing a layout asset, together with its
 * variants (name, optional description, price, on/off).
 */
class LayoutAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->name)) {
            $this->merge(['name' => trim($this->name)]);
        }

        if (is_array($this->variants)) {
            $this->merge(['variants' => array_map(function ($variant) {
                if (is_array($variant) && isset($variant['name']) && is_string($variant['name'])) {
                    $variant['name'] = trim($variant['name']);
                }

                return $variant;
            }, $this->variants)]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var LayoutAsset|null $asset */
        $asset = $this->route('asset');

        return [
            'name' => [
                'required', 'string', 'max:100',
                // unique regardless of case
                function (string $attribute, mixed $value, \Closure $fail) use ($asset) {
                    $taken = LayoutAsset::query()
                        ->whereRaw('LOWER(asset_name) = ?', [mb_strtolower($value)])
                        ->when($asset, fn ($q) => $q->where('asset_id', '!=', $asset->asset_id))
                        ->exists();

                    if ($taken) {
                        $fail('An asset with this name already exists.');
                    }
                },
            ],
            'category' => ['required', 'string', Rule::in(LayoutAsset::CATEGORIES)],
            'active' => ['sometimes', 'boolean'],

            'variants' => [
                'sometimes', 'array', 'max:50',
                // a new name must not clash with this asset's other saved variants
                function (string $attribute, mixed $value, \Closure $fail) use ($asset) {
                    if (! $asset || ! is_array($value)) {
                        return;
                    }

                    $ids = collect($value)->pluck('id')->filter()->all();
                    $names = collect($value)->pluck('name')->filter(fn ($n) => is_string($n))->map(fn ($n) => mb_strtolower($n));

                    $clash = AssetVariant::where('asset_id', $asset->asset_id)
                        ->whereNotIn('asset_variant_id', $ids)
                        ->get()
                        ->first(fn (AssetVariant $v) => $names->contains(mb_strtolower($v->variant_name)));

                    if ($clash) {
                        $fail("A variant named \"{$clash->variant_name}\" already exists for this asset.");
                    }
                },
            ],
            'variants.*.id' => [
                'nullable', 'integer',
                // an existing variant must belong to this asset
                function (string $attribute, mixed $value, \Closure $fail) use ($asset) {
                    $belongs = $asset && AssetVariant::where('asset_variant_id', $value)
                        ->where('asset_id', $asset->asset_id)
                        ->exists();

                    if (! $belongs) {
                        $fail('This variant does not belong to the asset.');
                    }
                },
            ],
            'variants.*.name' => ['required', 'string', 'max:100', 'distinct:ignore_case'],
            'variants.*.description' => ['nullable', 'string', 'max:255'],
            'variants.*.price' => ['required', 'numeric', 'min:0.01', 'max:99999999.99', 'decimal:0,2'],
            'variants.*.active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Asset name is required.',
            'category.in' => 'Choose one of the listed categories.',
            'variants.*.name.required' => 'Variant name is required.',
            'variants.*.name.distinct' => 'Each variant needs a different name.',
            'variants.*.price.required' => 'Enter a valid price.',
            'variants.*.price.numeric' => 'Enter a valid price.',
            'variants.*.price.min' => 'Enter a valid price.',
            'variants.*.price.decimal' => 'Use at most two decimal places.',
        ];
    }
}