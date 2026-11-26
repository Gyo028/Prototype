<?php

namespace App\Http\Requests\Customer;

use App\Models\LayoutAsset;
use App\Models\Service;
use App\Models\ServiceRequest;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Submitting a service request 
 * Field names match the customer form (camelCase).
 *
 * Two request types:
 *  - standard: eventTypeId, eventDate, eventStartTime, eventEndTime, guests,
 *              serviceIds (optional add-ons), and the preliminary layout:
 *              themeId, assetIds (the ticked library assets; none = the
 *              theme's default set), customItems ("Other" items: category,
 *              name, description)
 *  - custom:   projectTitle, startDate, endDate (no event type, times, guests or services)
 * Both:        requestType, venue, budget, description (optional), files (optional)
 *
 * Nothing has to be picked on Services & Assets: the Event Styling fee always
 * counts as a service, and no ticked asset means the theme's default set.
 * Whether an asset can be offered is checked by PreliminaryLayouts.
 */
class ServiceRequestRequest extends FormRequest
{
    public const MAX_FILES = 10;

    public const MAX_FILE_MB = 10;

    /** "Other" items a customer can add to the layout. */
    public const MAX_CUSTOM_ITEMS = 20;

    /** A standard event date must be at least this many months from today. */
    public const MIN_LEAD_MONTHS = 1;

    /** A custom project must start at least this many months from today. */
    public const MIN_CUSTOM_LEAD_MONTHS = 2;

    /** A standard event must run at least this long (end time minus start time). */
    public const MIN_EVENT_HOURS = 6;

    /** A custom project runs at most this many days, counting the first and the last day. */
    public const MAX_PROJECT_DAYS = 30;

    public function authorize(): bool
    {
        // The route is already limited to verified customers.
        return true;
    }

    public function isCustom(): bool
    {
        return $this->input('requestType') === ServiceRequest::TYPE_CUSTOM;
    }

    protected function prepareForValidation(): void
    {
        $trimmed = [];

        foreach (['venue', 'projectTitle', 'description'] as $field) {
            if (is_string($this->input($field))) {
                $trimmed[$field] = trim($this->input($field));
            }
        }

        $this->merge($trimmed);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $type = $this->isCustom() ? ServiceRequest::TYPE_CUSTOM : ServiceRequest::TYPE_STANDARD;

        $common = [
            'requestType' => ['required', Rule::in([ServiceRequest::TYPE_STANDARD, ServiceRequest::TYPE_CUSTOM])],
            'venue' => ['required', 'string', 'max:255'],
            // A range, or "exact" with the amount in budgetExact.
            'budget' => ['required', Rule::in([...ServiceRequest::budgetChoices($type), ServiceRequest::BUDGET_EXACT])],
            'budgetExact' => [
                'nullable', 'required_if:budget,'.ServiceRequest::BUDGET_EXACT, 'numeric', 'decimal:0,2',
                'min:'.ServiceRequest::MIN_EXACT_BUDGET[$type], 'max:99999999.99',
            ],
            'description' => ['nullable', 'string', 'max:5000'],
            'files' => ['nullable', 'array', 'max:'.self::MAX_FILES],
            'files.*' => ['file', 'mimes:jpg,jpeg,png,pdf', 'max:'.(self::MAX_FILE_MB * 1024)],
        ];

        return array_merge($common, $this->isCustom() ? $this->customRules() : $this->standardRules());
    }

    /** @return array<string, mixed> */
    private function standardRules(): array
    {
        $earliest = Carbon::today()->addMonthsNoOverflow(self::MIN_LEAD_MONTHS)->toDateString();

        return [
            'eventTypeId' => ['required', 'integer', Rule::exists('event_types', 'event_type_id')->where('status', 'active')],
            'eventDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$earliest],
            'eventStartTime' => ['required', 'date_format:H:i'],
            'eventEndTime' => [
                'bail', 'required', 'date_format:H:i',
                function (string $attribute, mixed $value, Closure $fail) {
                    $start = $this->input('eventStartTime');

                    // A missing or badly formatted start time is reported on its own field.
                    if (! is_string($start) || ! preg_match('/^\d{2}:\d{2}$/', $start)) {
                        return;
                    }

                    if ($this->toMinutes($value) - $this->toMinutes($start) < self::MIN_EVENT_HOURS * 60) {
                        $fail('The event must run at least '.self::MIN_EVENT_HOURS.' hours.');
                    }
                },
            ],
            'guests' => ['required', 'integer', 'min:1', 'max:100000'],
            'serviceIds' => ['nullable', 'array'],
            'serviceIds.*' => [
                'integer', 'distinct',
                // Active add-on services only: the Event Styling fee is added automatically.
                Rule::exists('services', 'service_id')->where(
                    fn ($query) => $query->where('status', 'active')->where('service_name', '!=', Service::BASE_FEE_NAME)
                ),
            ],

            // The preliminary layout.
            'themeId' => [
                'nullable', 'integer',
                Rule::exists('design_themes', 'theme_id')->where(
                    fn ($query) => $query->where('status', 'active')->where('event_type_id', (int) $this->input('eventTypeId'))
                ),
            ],
            'assetIds' => ['nullable', 'array', 'max:100'],
            'assetIds.*' => ['integer', 'distinct'],
            'customItems' => ['nullable', 'array', 'max:'.self::MAX_CUSTOM_ITEMS],
            'customItems.*' => ['array'],
            'customItems.*.category' => ['required', Rule::in(LayoutAsset::CATEGORIES)],
            'customItems.*.name' => ['required', 'string', 'max:50'],
            'customItems.*.description' => ['required', 'string', 'max:200'],
        ];
    }

    /** @return array<string, mixed> */
    private function customRules(): array
    {
        $earliest = Carbon::today()->addMonthsNoOverflow(self::MIN_CUSTOM_LEAD_MONTHS)->toDateString();

        return [
            'projectTitle' => ['required', 'string', 'max:150'],
            'startDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$earliest],
            'endDate' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:startDate',
                function (string $attribute, mixed $value, Closure $fail) {
                    $start = $this->input('startDate');

                    // Only judge a length when both dates are valid; the other rules report the rest.
                    if (! is_string($start) || ! is_string($value)
                        || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)
                        || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                        return;
                    }

                    $days = (int) Carbon::parse($start)->startOfDay()->diffInDays(Carbon::parse($value)->startOfDay()) + 1;

                    if ($days > self::MAX_PROJECT_DAYS) {
                        $fail('A custom project can run up to '.self::MAX_PROJECT_DAYS.' days.');
                    }
                },
            ],
        ];
    }

    private function toMinutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'requestType.required' => 'Choose Standard Event Styling or Custom Project.',
            'requestType.in' => 'Choose Standard Event Styling or Custom Project.',
            'venue.required' => 'Venue is required.',
            'budget.required' => 'Choose a budget range.',
            'budget.in' => 'Choose one of the listed budget ranges.',
            'budgetExact.required_if' => 'Enter your exact budget.',
            'budgetExact.numeric' => 'Enter your exact budget in pesos.',
            'budgetExact.decimal' => 'Use at most two decimal places.',
            'budgetExact.min' => 'Your exact budget must be at least ₱'.number_format(ServiceRequest::MIN_EXACT_BUDGET[$this->isCustom() ? ServiceRequest::TYPE_CUSTOM : ServiceRequest::TYPE_STANDARD]).'.',
            'budgetExact.max' => 'Enter a valid budget.',
            'description.max' => 'The description is too long.',
            'files.max' => 'You can upload up to '.self::MAX_FILES.' files.',
            'files.*.file' => 'The file could not be uploaded. Only JPG, PNG or PDF up to '.self::MAX_FILE_MB.' MB.',
            'files.*.uploaded' => 'The file could not be uploaded. Only JPG, PNG or PDF up to '.self::MAX_FILE_MB.' MB.',
            'files.*.mimes' => 'Only JPG, PNG or PDF files are allowed.',
            'files.*.max' => 'Each file can be up to '.self::MAX_FILE_MB.' MB.',

            'eventTypeId.required' => 'Choose an event type.',
            'eventTypeId.integer' => 'Choose an event type.',
            'eventTypeId.exists' => 'Choose one of the listed event types.',
            'eventDate.required' => 'Choose the event date.',
            'eventDate.date_format' => 'Choose a valid event date.',
            'eventDate.after_or_equal' => 'The event date must be at least '.self::MIN_LEAD_MONTHS.' month from today.',
            'eventStartTime.required' => 'Choose the start time.',
            'eventStartTime.date_format' => 'Choose a valid start time.',
            'eventEndTime.required' => 'Choose the end time.',
            'eventEndTime.date_format' => 'Choose a valid end time.',
            'guests.required' => 'Enter the expected number of guests.',
            'guests.integer' => 'Enter the expected number of guests.',
            'guests.min' => 'Enter the expected number of guests.',
            'guests.max' => 'Enter a valid number of guests.',
            'serviceIds.array' => 'Choose only services from the list.',
            'serviceIds.*.exists' => 'Choose only services from the list.',
            'themeId.exists' => 'Choose one of the design themes for your event type.',
            'themeId.integer' => 'Choose one of the design themes for your event type.',
            'assetIds.*.integer' => 'Choose only design assets from the list.',
            'assetIds.*.distinct' => 'Each design asset can be added once.',
            'customItems.max' => 'You can add up to '.self::MAX_CUSTOM_ITEMS.' "Other" items.',
            'customItems.*.category.required' => 'Choose a category for each "Other" item.',
            'customItems.*.category.in' => 'Choose a category for each "Other" item.',
            'customItems.*.name.required' => 'Tell us what each "Other" item is.',
            'customItems.*.name.max' => 'Keep each "Other" item name to 50 characters.',
            'customItems.*.description.required' => 'Describe each "Other" item.',
            'customItems.*.description.max' => 'Keep each "Other" item description to 200 characters.',

            'projectTitle.required' => 'Enter a project title.',
            'startDate.required' => 'Choose the start date.',
            'startDate.date_format' => 'Choose a valid start date.',
            'startDate.after_or_equal' => 'The start date must be at least '.self::MIN_CUSTOM_LEAD_MONTHS.' months from today.',
            'endDate.required' => 'Choose the end date.',
            'endDate.date_format' => 'Choose a valid end date.',
            'endDate.after_or_equal' => 'The end date cannot be before the start date.',
        ];
    }
}
