<?php

namespace App\Http\Requests\Customer;

use App\Models\ProjectSchedule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Booking, rescheduling or cancelling a consultation.
 *
 *  - book:        date, time, meetingMode, meetingPlace (face to face only)
 *  - reschedule:  date, time, meetingMode, meetingPlace, reason
 *  - cancel:      reason
 *
 * Whether the slot itself is free is checked by ConsultationScheduler.
 */
class ConsultationRequest extends FormRequest
{
    public const REASON_MAX = 200;

    public const PLACE_MAX = 255;

    public function authorize(): bool
    {
        // The route is limited to customers; the controller checks the project is theirs.
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }

        // One line; an online meeting has no place.
        $place = $this->input('meetingPlace');
        $this->merge([
            'meetingPlace' => $this->input('meetingMode') === ProjectSchedule::MODE_FACE_TO_FACE && is_string($place)
                ? (trim((string) preg_replace('/\s+/u', ' ', $place)) ?: null)
                : null,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $reason = ['required', 'string', 'max:'.self::REASON_MAX];

        if ($this->routeIs('customer.projects.consultation.cancel')) {
            return ['reason' => $reason];
        }

        $slot = [
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i'],
            'meetingMode' => ['required', Rule::in([ProjectSchedule::MODE_ONLINE, ProjectSchedule::MODE_FACE_TO_FACE])],
            'meetingPlace' => ['nullable', 'required_if:meetingMode,'.ProjectSchedule::MODE_FACE_TO_FACE, 'string', 'max:'.self::PLACE_MAX],
        ];

        return $this->routeIs('customer.projects.consultation.reschedule')
            ? $slot + ['reason' => $reason]
            : $slot;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'date.required' => 'Pick a date.',
            'time.required' => 'Pick a time.',
            'meetingMode.required' => 'Choose online or face to face.',
            'meetingPlace.required_if' => 'Tell us where to meet.',
            'meetingPlace.max' => 'Keep the place under '.self::PLACE_MAX.' characters.',
            'reason.required' => 'Please give a reason.',
            'reason.max' => 'Keep the reason under '.self::REASON_MAX.' characters.',
        ];
    }
}
