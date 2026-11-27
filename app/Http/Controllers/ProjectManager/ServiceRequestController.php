<?php

namespace App\Http\Controllers\ProjectManager;

use App\Http\Controllers\Controller;
use App\Mail\NoticeMail;
use App\Http\Controllers\Customer\ProjectController as CustomerProjectController;
use App\Models\Employee;
use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestFile;
use App\Models\ServiceRequestService;
use App\Services\ProjectNotices;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backlog #13: Project Manager > Service Requests.
 *
 *  - index    every service request, first come, first served (oldest first)
 *  - show     one request on its own page (revision, Nov 19)
 *  - approve  the request becomes a project (status "Consultation"); remarks optional
 *  - reject   remarks are required (acceptance criterion 2)
 *  - file     a reference file the customer uploaded
 *
 * The customer sees the decision (and the rejection remarks) on their own request page.
 */
class ServiceRequestController extends Controller
{
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    private const RELATIONS = ['customer.user', 'eventType', 'services.service', 'files', 'project.projectManager'];

    public function index(): Response
    {
        $requests = ServiceRequest::query()
            ->with(self::RELATIONS)
            ->orderBy('created_at')
            ->orderBy('service_request_id')
            ->get()
            ->map(fn (ServiceRequest $r) => self::toArray($r))
            ->values();

        return Inertia::render('project-manager/service-requests', ['requests' => $requests]);
    }

    public function show(ServiceRequest $serviceRequest): Response
    {
        $serviceRequest->load(self::RELATIONS);

        return Inertia::render('project-manager/service-request-show', ['request' => self::toArray($serviceRequest)]);
    }

        /** Acceptance criterion 1: the decision is saved and the request becomes a project. */
    public function approve(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $data = $request->validate(['remarks' => ['nullable', 'string', 'max:1000']]);

        self::ensurePending($serviceRequest);
        $manager = self::managerFor($request);

        DB::transaction(function () use ($serviceRequest, $manager, $data) {
            $serviceRequest->update([
                'request_status' => ServiceRequest::STATUS_APPROVED,
                'pm_remarks' => self::clean($data['remarks'] ?? null),
                'reviewed_at' => now(),
            ]);

            $project = Project::create([
                'service_request_id' => $serviceRequest->service_request_id,
                'project_manager_id' => $manager->employee_id,
                'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
            ]);

            // The event date, kept as tentative until the reservation fee is verified (same as the seeders).
            $project->schedules()->create($serviceRequest->isCustom()
                ? [
                    'schedule_type' => ProjectSchedule::TYPE_EVENT,
                    'start_datetime' => $serviceRequest->start_date->copy()->startOfDay(),
                    'end_datetime' => $serviceRequest->end_date->copy()->endOfDay(),
                    'schedule_status' => ProjectSchedule::STATUS_TENTATIVE,
                ]
                : [
                    'schedule_type' => ProjectSchedule::TYPE_EVENT,
                    'start_datetime' => $serviceRequest->start_date->toDateString().' '.$serviceRequest->event_start_time,
                    'end_datetime' => $serviceRequest->end_date->toDateString().' '.$serviceRequest->event_end_time,
                    'schedule_status' => ProjectSchedule::STATUS_TENTATIVE,
                ]);
        });

        // Acceptance criterion 1: the customer is notified (Workflow: by email).
        self::notifyDecision($serviceRequest->fresh(), true);
        return back();
    }

    /** Acceptance criterion 2: a rejection is never saved without remarks. */
    public function reject(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $data = $request->validate(
            ['remarks' => ['required', 'string', 'max:1000']],
            ['remarks.required' => 'Remarks are required when rejecting a request. Tell the customer why it was rejected.'],
        );

        self::ensurePending($serviceRequest);

        $serviceRequest->update([
            'request_status' => ServiceRequest::STATUS_REJECTED,
            'pm_remarks' => self::clean($data['remarks']),
            'reviewed_at' => now(),
        ]);

        // Acceptance criterion 1: the customer is notified (Workflow: by email).
        self::notifyDecision($serviceRequest->fresh(), false);
        return back();
    }

        /**
     * Emails the customer the decision (fix list, Nov 27). Approved: prompts them to book a
     * consultation (Workflow). Rejected: includes the remarks.
     */
    private static function notifyDecision(ServiceRequest $serviceRequest, bool $approved): void
    {
        $serviceRequest->loadMissing(['customer.user', 'eventType']);
        $event = $serviceRequest->isCustom() ? (string) $serviceRequest->project_title : ($serviceRequest->eventType?->event_type_name ?? 'Event');

        $details = [
            'Request' => (string) $serviceRequest->request_code,
            'Event' => $event.' · '.$serviceRequest->start_date->format('M j, Y'),
            'Decision' => $approved ? 'Approved' : 'Rejected',
        ];
        if ($serviceRequest->pm_remarks) {
            $details['Remarks'] = $serviceRequest->pm_remarks;
        }

        ProjectNotices::send($serviceRequest->customer?->user?->email, new NoticeMail(
            subjectLine: 'Your service request was '.($approved ? 'approved' : 'rejected')." · {$serviceRequest->request_code}",
            heading: $approved ? 'Your service request was approved' : 'Your service request was rejected',
            greeting: 'Hi '.($serviceRequest->customer?->full_name ?? 'there').',',
            lines: [$approved
                ? 'Good news! Your request is now a project. Please log in and book your consultation appointment.'
                : 'We are sorry, we cannot take this request. Please see the remarks below.'],
            details: $details,
        ));
    }
    /** Shows a reference file in the browser, or downloads it with ?download=1. */
    public function file(Request $request, ServiceRequest $serviceRequest, ServiceRequestFile $file): StreamedResponse
    {
        abort_unless((int) $file->service_request_id === (int) $serviceRequest->service_request_id, 404);
        abort_unless(Storage::exists($file->file_path), 404);

        return $request->boolean('download')
            ? Storage::download($file->file_path, $file->file_name)
            : Storage::response($file->file_path, $file->file_name);
    }

        /* ---------- helpers ---------- */

    /** Only a pending request can be approved or rejected (e.g. two tabs, or a double click). */
    private static function ensurePending(ServiceRequest $serviceRequest): void
    {
        if ($serviceRequest->request_status !== ServiceRequest::STATUS_PENDING) {
            throw ValidationException::withMessages(['remarks' => 'This request was already '.$serviceRequest->request_status.'.']);
        }
    }

    /** The employee record of the logged-in Project Manager (projects.project_manager_id points to employees). */
    private static function managerFor(Request $request): Employee
    {
        $manager = Employee::query()->where('user_id', $request->user()->id)->first();

        if ($manager === null) {
            throw ValidationException::withMessages(['remarks' => 'Your account is not linked to an employee record. Ask the Technical Admin to link it.']);
        }

        return $manager;
    }

    private static function clean(?string $text): ?string
    {
        $text = trim((string) $text);

        return $text === '' ? null : $text;
    }

    /** "₱50,000 – ₱100,000", the label the customer picked. */
    private static function budgetLabel(ServiceRequest $r): string
    {
        foreach (ServiceRequest::BUDGET_RANGES as $label => [$min, $max]) {
            $sameMax = $max === null ? $r->budget_max === null : ($r->budget_max !== null && (float) $r->budget_max === (float) $max);
            if ((float) $r->budget_min === (float) $min && $sameMax) {
                return $label;
            }
        }

        return '₱'.number_format((float) $r->budget_min).($r->budget_max === null ? ' and above' : ' – ₱'.number_format((float) $r->budget_max));
    }

        /**
     * One request in the shape the Project Manager pages expect
     * (resources/js/data/project-manager/project-requests.ts, type ProjectRequest).
     *
     * @return array<string, mixed>
     */
    public static function toArray(ServiceRequest $r): array
    {
        $customer = $r->customer;

        return [
            'id' => $r->service_request_id,
            'code' => (string) $r->request_code,
            'title' => $r->isCustom() ? (string) $r->project_title : ($r->eventType?->event_type_name ?? 'Event'), // leader: the event type only
            'requestType' => $r->request_type,
            'customer' => [
                'name' => $customer?->full_name ?? 'Customer',
                'email' => $customer?->user?->email ?? '',
                'phone' => $customer?->contact_number,
            ],
            'eventType' => $r->eventType?->event_type_name ?? 'Custom Project',
            'eventDate' => $r->start_date->toDateString(),
            'endDate' => $r->end_date->toDateString(),
            // Custom projects have a date range and no times ('').
            'startTime' => $r->event_start_time ? substr($r->event_start_time, 0, 5) : '',
            'endTime' => $r->event_end_time ? substr($r->event_end_time, 0, 5) : '',
            'venue' => $r->venue,
            'venueSetting' => null, // not stored in the database
            'guests' => $r->guest_count,
            'budget' => self::budgetLabel($r),
            'description' => (string) $r->project_description,
            'services' => $r->services->map(fn (ServiceRequestService $line) => [
                'id' => $line->request_service_id,
                'name' => $line->service?->service_name ?? 'Service',
                'category' => $line->service?->service_category ?? '',
                'price' => (float) $line->unit_price,
                'unit' => $line->service?->pricing_type === 'per_unit' ? (string) $line->service?->unit_type : '',
                'quantity' => (int) $line->quantity,
                'subtotal' => (float) $line->subtotal,
            ])->values(),
            'theme' => null, // not stored in the database
            'assets' => [],
            'files' => $r->files->map(fn (ServiceRequestFile $f) => [
                'id' => $f->request_file_id,
                'name' => $f->file_name,
                'type' => in_array(strtolower(pathinfo($f->file_name, PATHINFO_EXTENSION)), self::IMAGE_EXTENSIONS, true) ? 'image' : 'pdf',
                'url' => "/project-manager/service-requests/{$r->service_request_id}/files/{$f->request_file_id}",
            ])->values(),
            'layoutSnapshotUrl' => null,
            'submittedAt' => $r->created_at?->toIso8601String() ?? $r->request_date->toDateString(),
            'status' => ucfirst($r->request_status),
            'decision' => $r->request_status === ServiceRequest::STATUS_PENDING ? null : [
                'remarks' => $r->pm_remarks,
                // The database keeps who approved (the project's manager), not who rejected.
                'decidedBy' => $r->project?->projectManager?->full_name ?? 'Project Manager',
                'decidedAt' => ($r->reviewed_at ?? $r->updated_at)?->toIso8601String(),
            ],
            'consultation' => null, // backlog #16
        ];
    }
}