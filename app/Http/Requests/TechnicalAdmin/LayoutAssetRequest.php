<?php

namespace App\Http\Requests\TechnicalAdmin;

use App\Models\LayoutAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Used for both adding and editing a layout asset: name, category, its one
 * price, and how it is counted on a layout (fixed, or per guest with the
 * number of guests one unit serves).
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
            'price' => ['required', 'numeric', 'min:0.01', 'max:99999999.99', 'decimal:0,2'],
            'pricingType' => ['required', Rule::in([LayoutAsset::PRICING_FIXED, LayoutAsset::PRICING_PER_GUEST])],
            'guestsPerUnit' => ['nullable', 'required_if:pricingType,'.LayoutAsset::PRICING_PER_GUEST, 'integer', 'min:1', 'max:1000'],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Asset name is required.',
            'category.in' => 'Choose one of the listed categories.',
            'price.required' => 'Enter a valid price.',
            'price.numeric' => 'Enter a valid price.',
            'price.min' => 'Enter a valid price.',
            'price.max' => 'Enter a valid price.',
            'price.decimal' => 'Use at most two decimal places.',
            'pricingType.required' => 'Choose how the price is counted.',
            'pricingType.in' => 'Choose how the price is counted.',
            'guestsPerUnit.required_if' => 'Enter how many guests one unit serves.',
            'guestsPerUnit.integer' => 'Enter a whole number of guests.',
            'guestsPerUnit.min' => 'Enter at least 1 guest.',
            'guestsPerUnit.max' => 'Enter at most 1,000 guests.',
        ];
    }
}
