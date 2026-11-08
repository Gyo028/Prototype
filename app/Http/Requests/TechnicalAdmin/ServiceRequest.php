<?php

namespace App\Http\Requests\TechnicalAdmin;

use App\Models\Service;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Used for both adding and editing a service. Field names match the screen's
 * form (pricingType, unitType). For the Event Styling fee only the
 * description and price are checked, since nothing else can change.
 */
class ServiceRequest extends FormRequest
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
        /** @var Service|null $service */
        $service = $this->route('service');

        $common = [
            'description' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0.01', 'max:99999999.99', 'decimal:0,2'],
        ];

        if ($service?->isBaseFee()) {
            return $common;
        }

        return $common + [
            'name' => [
                'required', 'string', 'max:100',
                // unique regardless of case, and never a second "Event Styling"
                function (string $attribute, mixed $value, \Closure $fail) use ($service) {
                    $taken = Service::query()
                        ->whereRaw('LOWER(service_name) = ?', [mb_strtolower($value)])
                        ->when($service, fn ($q) => $q->where('service_id', '!=', $service->service_id))
                        ->exists();

                    if ($taken || mb_strtolower($value) === mb_strtolower(Service::BASE_FEE_NAME)) {
                        $fail('A service with this name already exists.');
                    }
                },
            ],
            'category' => ['required', 'string', Rule::in(Service::CATEGORIES)],
            'pricingType' => ['required', Rule::in([Service::PRICING_FIXED, Service::PRICING_PER_UNIT])],
            'unitType' => ['nullable', 'required_if:pricingType,per_unit', Rule::in(Service::UNIT_TYPES)],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Service name is required.',
            'description.required' => 'Description is required.',
            'price.required' => 'Enter a valid price.',
            'price.numeric' => 'Enter a valid price.',
            'price.min' => 'Enter a valid price.',
            'price.decimal' => 'Use at most two decimal places.',
            'category.in' => 'Choose one of the listed categories.',
            'unitType.required_if' => 'Choose a unit type.',
            'unitType.in' => 'Choose a unit type.',
        ];
    }
}