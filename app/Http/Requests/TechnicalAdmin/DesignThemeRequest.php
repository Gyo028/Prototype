<?php

namespace App\Http\Requests\TechnicalAdmin;

use App\Models\DesignTheme;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Used for both adding and editing a design theme. Field names match the
 * screen's form (eventTypeId, maxGuests).
 */
class DesignThemeRequest extends FormRequest
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
        /** @var DesignTheme|null $theme */
        $theme = $this->route('theme');

        return [
            'name' => [
                'required', 'string', 'max:100',
                // unique regardless of case
                function (string $attribute, mixed $value, \Closure $fail) use ($theme) {
                    $taken = DesignTheme::query()
                        ->whereRaw('LOWER(theme_name) = ?', [mb_strtolower($value)])
                        ->when($theme, fn ($q) => $q->where('theme_id', '!=', $theme->theme_id))
                        ->exists();

                    if ($taken) {
                        $fail('A theme with this name already exists.');
                    }
                },
            ],
            'eventTypeId' => ['required', 'integer', Rule::exists('event_types', 'event_type_id')],
            'venue' => ['required', Rule::in([DesignTheme::VENUE_INDOOR, DesignTheme::VENUE_OUTDOOR])],
            'style' => ['required', Rule::in(DesignTheme::STYLES)],
            'maxGuests' => ['required', 'integer', 'min:1', 'max:100000'],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.required' => 'Theme name is required.',
            'eventTypeId.required' => 'Choose an event type.',
            'eventTypeId.exists' => 'Choose one of the listed event types.',
            'venue.in' => 'Choose indoor or outdoor.',
            'style.in' => 'Choose one of the listed styles.',
            'maxGuests.required' => 'Enter a valid guest cap.',
            'maxGuests.integer' => 'Enter a valid guest cap.',
            'maxGuests.min' => 'Enter a valid guest cap.',
            'maxGuests.max' => 'Enter a valid guest cap.',
        ];
    }
}