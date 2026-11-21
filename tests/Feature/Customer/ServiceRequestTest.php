<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\Service;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);

    $this->user = User::factory()->create(['role' => Role::Customer]);
    $this->customer = Customer::create([
        'user_id' => $this->user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ]);
});

function srServiceId(string $name): int
{
    return Service::where('service_name', $name)->value('service_id');
}

function srStandard(array $overrides = []): array
{
    return array_merge([
        'requestType' => 'standard',
        'eventTypeId' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'eventDate' => now()->addMonths(2)->toDateString(),
        'eventStartTime' => '14:00',
        'eventEndTime' => '22:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guests' => 150,
        'budget' => '₱250,000 – ₱500,000',
        'description' => 'Rustic garden wedding with warm lighting.',
        'serviceIds' => [srServiceId('DJ Services'), srServiceId('Buffet Catering')],
    ], $overrides);
}

function srCustom(array $overrides = []): array
{
    return array_merge([
        'requestType' => 'custom',
        'projectTitle' => 'Christmas mall center display',
        'startDate' => now()->addMonths(3)->toDateString(),
        'endDate' => now()->addMonths(3)->addDays(20)->toDateString(),
        'venue' => 'SM Mall, Main Atrium',
        'budget' => 'Above ₱500,000',
        'description' => 'A walk-through winter scene for the main atrium.',
    ], $overrides);
}

/* ---------------- The form's data ---------------- */

test('the customer gets what is switched on, and the budget ranges', function () {
    Service::where('service_name', 'DJ Services')->update(['status' => 'inactive']);
    EventType::where('event_type_name', 'Debut')->update(['status' => 'inactive']);
    LayoutAsset::where('asset_name', 'Fairy Lights')->update(['status' => 'inactive']);

    $this->actingAs($this->user)
        ->get(route('customer.new-request'))
        ->assertOk()
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $props = $all['props'] ?? $all;
            $serviceNames = collect($props['services'])->pluck('name')->all();
            $themeNames = collect($props['themes'])->pluck('name')->all();

            expect($serviceNames)->toHaveCount(5)
                ->and($serviceNames)->not->toContain('Event Styling')   // the fee is sent separately
                ->and($serviceNames)->not->toContain('DJ Services')     // switched off
                ->and($themeNames)->toHaveCount(7)
                ->and($themeNames)->not->toContain('Debut Glam')        // its event type is switched off
                ->and($props['eventTypes'])->toHaveCount(3)
                ->and($props['assets'])->toHaveCount(7)
                ->and($props['baseFee']['name'])->toBe('Event Styling')
                ->and((float) $props['baseFee']['price'])->toBe(45000.0)
                ->and($props['budgetRanges']['standard'])->toHaveCount(5)
                ->and($props['budgetRanges']['custom'])->toHaveCount(4)
                ->and($props['budgetRanges']['custom'][0])->toBe('₱50,000 – ₱100,000')
                ->and($props['limits']['maxFiles'])->toBe(10)
                ->and($props['profileMissing'])->toBeFalse();

            $page->component('customer/project-request');
        });
});

test('only customers can open or submit the form', function () {
    $admin = User::factory()->create(['role' => Role::TechnicalAdmin]);

    // Guest first: once actingAs runs, later requests in this test stay signed in.
    $this->post(route('customer.new-request.store'), srStandard())->assertRedirect(route('login'));

    $this->actingAs($admin)->get(route('customer.new-request'))->assertForbidden();
    $this->actingAs($admin)->post(route('customer.new-request.store'), srStandard())->assertForbidden();

    expect(ServiceRequest::count())->toBe(0);
});

test('a customer without a profile is told so and cannot submit', function () {
    $noProfile = User::factory()->create(['role' => Role::Customer]);

    $this->actingAs($noProfile)
        ->get(route('customer.new-request'))
        ->assertInertia(fn (Assert $page) => $page->where('profileMissing', true));

    $this->actingAs($noProfile)
        ->post(route('customer.new-request.store'), srStandard())
        ->assertSessionHasErrors('profile');

    expect(ServiceRequest::count())->toBe(0);
});

/* ---------------- Standard Event Styling ---------------- */

test('a standard request is saved with the styling fee, the services and their prices', function () {
    $date = now()->addMonths(2)->toDateString();

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['eventDate' => $date]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('customer.new-request'));

    $request = ServiceRequest::with('services.service')->firstOrFail();

    expect($request->customer_id)->toBe($this->customer->customer_id)
        ->and($request->request_type)->toBe('standard')
        ->and($request->request_status)->toBe('pending')
        ->and($request->request_date->toDateString())->toBe(today()->toDateString())
        ->and($request->start_date->toDateString())->toBe($date)
        ->and($request->end_date->toDateString())->toBe($date)
        ->and(substr($request->event_start_time, 0, 5))->toBe('14:00')
        ->and(substr($request->event_end_time, 0, 5))->toBe('22:00')
        ->and($request->guest_count)->toBe(150)
        ->and($request->project_title)->toBeNull()
        ->and($request->budget_min)->toBe('250000.00')
        ->and($request->budget_max)->toBe('500000.00')
        ->and($request->services)->toHaveCount(3);

    $lines = $request->services->mapWithKeys(fn ($line) => [$line->service->service_name => $line]);

    expect($lines['Event Styling']->subtotal)->toBe('45000.00')
        ->and($lines['DJ Services']->subtotal)->toBe('15000.00')
        ->and($lines['Buffet Catering']->quantity)->toBe(150)        // per guest
        ->and($lines['Buffet Catering']->unit_price)->toBe('650.00')
        ->and($lines['Buffet Catering']->subtotal)->toBe('97500.00');
});

test('incomplete or invalid standard requests are not saved', function (array $override, string $error) {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard($override))
        ->assertSessionHasErrors($error);

    expect(ServiceRequest::count())->toBe(0);
})->with([
    'unknown request type' => [['requestType' => 'weird'], 'requestType'],
    'missing event type' => [['eventTypeId' => ''], 'eventTypeId'],
    'unknown event type' => [['eventTypeId' => 9999], 'eventTypeId'],
    'missing date' => [['eventDate' => ''], 'eventDate'],
    'date in the wrong format' => [['eventDate' => '16/01/2027'], 'eventDate'],
    'date less than 1 month away' => [['eventDate' => '2020-01-01'], 'eventDate'],
    'missing start time' => [['eventStartTime' => ''], 'eventStartTime'],
    'missing end time' => [['eventEndTime' => ''], 'eventEndTime'],
    'ends before it starts' => [['eventStartTime' => '14:00', 'eventEndTime' => '12:00'], 'eventEndTime'],
    'shorter than 6 hours' => [['eventStartTime' => '14:00', 'eventEndTime' => '19:30'], 'eventEndTime'],
    'missing venue' => [['venue' => ''], 'venue'],
    'missing budget' => [['budget' => ''], 'budget'],
    'unknown budget' => [['budget' => 'Free'], 'budget'],
    'missing guests' => [['guests' => ''], 'guests'],
    'zero guests' => [['guests' => 0], 'guests'],
    'no services' => [['serviceIds' => []], 'serviceIds'],
]);

test('a switched-off event type, the styling fee and switched-off services cannot be chosen', function () {
    EventType::where('event_type_name', 'Debut')->update(['status' => 'inactive']);
    Service::where('service_name', 'Photobooth Rental')->update(['status' => 'inactive']);

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['eventTypeId' => EventType::where('event_type_name', 'Debut')->value('event_type_id')]))
        ->assertSessionHasErrors('eventTypeId');

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['serviceIds' => [srServiceId('Event Styling')]]))
        ->assertSessionHasErrors('serviceIds.0');

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['serviceIds' => [srServiceId('Photobooth Rental')]]))
        ->assertSessionHasErrors('serviceIds.0');

    expect(ServiceRequest::count())->toBe(0);
});

/* ---------------- Custom Projects ---------------- */

test('a custom project is saved with its title and dates, and no services, times or guests', function () {
    $start = now()->addMonths(3)->toDateString();
    $end = now()->addMonths(3)->addDays(20)->toDateString();

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srCustom([
            'startDate' => $start,
            'endDate' => $end,
            // A custom project has none of these, so they are ignored even if sent.
            'serviceIds' => [srServiceId('DJ Services')],
            'guests' => 300,
            'eventStartTime' => '10:00',
        ]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('customer.new-request'));

    $request = ServiceRequest::with('services')->firstOrFail();

    expect($request->request_type)->toBe('custom')
        ->and($request->project_title)->toBe('Christmas mall center display')
        ->and($request->event_type_id)->toBeNull()
        ->and($request->start_date->toDateString())->toBe($start)
        ->and($request->end_date->toDateString())->toBe($end)
        ->and($request->event_start_time)->toBeNull()
        ->and($request->event_end_time)->toBeNull()
        ->and($request->guest_count)->toBeNull()
        ->and($request->budget_min)->toBe('500000.00')
        ->and($request->budget_max)->toBeNull()
        ->and($request->services)->toHaveCount(0);
});

test('a custom project can start and end on the same day', function () {
    $day = now()->addMonths(3)->toDateString();

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srCustom(['startDate' => $day, 'endDate' => $day]))
        ->assertSessionHasNoErrors();

    expect(ServiceRequest::count())->toBe(1);
});

test('a custom project can run up to 30 days, counting both ends', function () {
    $start = now()->addMonths(3);

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srCustom([
            'startDate' => $start->toDateString(),
            'endDate' => $start->copy()->addDays(29)->toDateString(),
        ]))
        ->assertSessionHasNoErrors();

    expect(ServiceRequest::count())->toBe(1);
});

test('a custom project longer than 30 days is not saved', function () {
    $start = now()->addMonths(3);

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srCustom([
            'startDate' => $start->toDateString(),
            'endDate' => $start->copy()->addDays(30)->toDateString(),
        ]))
        ->assertSessionHasErrors('endDate');

    expect(ServiceRequest::count())->toBe(0);
});

test('incomplete or invalid custom projects are not saved', function (array $override, string $error) {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srCustom($override))
        ->assertSessionHasErrors($error);

    expect(ServiceRequest::count())->toBe(0);
})->with([
    'missing title' => [['projectTitle' => ''], 'projectTitle'],
    'title too long' => [['projectTitle' => str_repeat('a', 151)], 'projectTitle'],
    'missing start date' => [['startDate' => ''], 'startDate'],
    'start date in the past' => [['startDate' => '2020-01-01'], 'startDate'],
    'start date less than 2 months away' => [['startDate' => now()->addMonth()->toDateString()], 'startDate'],
    'missing end date' => [['endDate' => ''], 'endDate'],
    'ends before it starts' => [['startDate' => '2099-06-10', 'endDate' => '2099-06-01'], 'endDate'],
    'missing venue' => [['venue' => ''], 'venue'],
    'missing budget' => [['budget' => ''], 'budget'],
    'budget below 50,000 is not offered' => [['budget' => 'Below ₱50,000'], 'budget'],
]);

/* ---------------- Reference files ---------------- */

test('reference files are stored privately and saved with the request', function () {
    Storage::fake('local');

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard([
            'files' => [
                UploadedFile::fake()->create('arch-inspiration.jpg', 100, 'image/jpeg'),
                UploadedFile::fake()->create('seating-plan.pdf', 200, 'application/pdf'),
            ],
        ]))
        ->assertSessionHasNoErrors();

    $serviceRequest = ServiceRequest::with('files')->firstOrFail();

    expect($serviceRequest->files)->toHaveCount(2)
        ->and($serviceRequest->files->pluck('file_name')->all())->toEqualCanonicalizing(['arch-inspiration.jpg', 'seating-plan.pdf']);

    foreach ($serviceRequest->files as $file) {
        expect($file->file_path)->toStartWith("service-requests/{$serviceRequest->service_request_id}/");
        Storage::disk('local')->assertExists($file->file_path);
    }
});

test('reference files must be JPG, PNG or PDF, up to 10 MB each, at most 10', function (Closure $files, string $error) {
    Storage::fake('local');

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['files' => $files()]))
        ->assertSessionHasErrors($error);

    expect(ServiceRequest::count())->toBe(0);
})->with([
    'a GIF' => [fn () => [UploadedFile::fake()->create('a.gif', 10, 'image/gif')], 'files.0'],
    'a Word file' => [fn () => [UploadedFile::fake()->create('a.docx', 10, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')], 'files.0'],
    'a file over 10 MB' => [fn () => [UploadedFile::fake()->create('big.pdf', 10241, 'application/pdf')], 'files.0'],
    'more than 10 files' => [fn () => array_map(fn ($i) => UploadedFile::fake()->create("photo-{$i}.jpg", 10, 'image/jpeg'), range(1, 11)), 'files'],
]);

test('ten files are accepted', function () {
    Storage::fake('local');

    $files = array_map(fn ($i) => UploadedFile::fake()->create("photo-{$i}.jpg", 10, 'image/jpeg'), range(1, 10));

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['files' => $files]))
        ->assertSessionHasNoErrors();

    expect(ServiceRequest::firstOrFail()->files)->toHaveCount(10);
});
