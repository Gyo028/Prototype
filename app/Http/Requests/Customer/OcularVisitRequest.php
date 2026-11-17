<?php

namespace App\Http\Requests\Customer;

use App\Models\ProjectSchedule;
use App\Models\SiteAccessDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Booking or rescheduling the ocular visit.
 *
 *  - book:        date, time, venueOwnership, and optionally authorizationLetter
 *                 and venuePermit (third-party venue only; PDF, JPG or PNG, up to 5 MB)
 *  - reschedule:  date, time, reason (the venue and documents carry over)
 *
 * Always face to face, so there is no meeting mode. Whether the slot is free
 * is checked by OcularVisitScheduler.
 */
class OcularVisitRequest extends FormRequest
{
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
        $slot = [
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i'],
        ];

        if ($this->routeIs('customer.projects.ocular-visit.reschedule')) {
            return $slot + ['reason' => ['required', 'string', 'max:'.ConsultationRequest::REASON_MAX]];
        }

        $file = ['nullable', 'file', 'mimes:'.implode(',', SiteAccessDocument::MIMES), 'max:'.(SiteAccessDocument::MAX_MB * 1024)];

        return $slot + [
            'venueOwnership' => ['required', Rule::in([ProjectSchedule::VENUE_OWN_PROPERTY, ProjectSchedule::VENUE_THIRD_PARTY])],
            'authorizationLetter' => $file,
            'venuePermit' => $file,
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'date.required' => 'Pick a date.',
            'time.required' => 'Pick a time.',
            'venueOwnership.required' => 'Tell us whose venue it is.',
            'venueOwnership.in' => 'Tell us whose venue it is.',
            'authorizationLetter.mimes' => 'The authorization letter must be a PDF, JPG or PNG file.',
            'authorizationLetter.max' => 'The authorization letter must be '.SiteAccessDocument::MAX_MB.' MB or smaller.',
            'authorizationLetter.uploaded' => 'The authorization letter could not be uploaded. It must be '.SiteAccessDocument::MAX_MB.' MB or smaller.',
            'venuePermit.mimes' => 'The venue permit must be a PDF, JPG or PNG file.',
            'venuePermit.max' => 'The venue permit must be '.SiteAccessDocument::MAX_MB.' MB or smaller.',
            'venuePermit.uploaded' => 'The venue permit could not be uploaded. It must be '.SiteAccessDocument::MAX_MB.' MB or smaller.',
            'reason.required' => 'Please give a reason.',
            'reason.max' => 'Keep the reason under '.ConsultationRequest::REASON_MAX.' characters.',
        ];
    }
}
