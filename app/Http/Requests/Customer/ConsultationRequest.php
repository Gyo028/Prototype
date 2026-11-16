<?php

namespace App\Http\Requests\Customer;

use App\Models\ProjectSchedule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Booking, rescheduling or cancelling a consultation.
 *
 *  - book:        date, time, meetingMode
 *  - reschedule:  date, time, meetingMode, reason
 *  - cancel:      reason
 *
 * Whether the slot itself is free is checked by ConsultationScheduler.
 */
class ConsultationRequest extends FormRequest
{
    public const REASON_MAX = 200;

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
            'reason.required' => 'Please give a reason.',
            'reason.max' => 'Keep the reason under '.self::REASON_MAX.' characters.',
        ];
    }
}
