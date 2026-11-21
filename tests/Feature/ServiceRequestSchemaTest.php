<?php

use App\Models\Customer;
use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\Service;
use App\Models\ServiceRequest;
use App\Models\ServiceRequestService;
use App\Models\User;
use Database\Seeders\CustomerSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

function newCustomerProfile(array $overrides = []): Customer
{
    return Customer::create(array_merge([
        'user_id' => User::factory()->create()->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => '09171234567',
    ], $overrides));
}

function newStandardRequest(Customer $customer, array $overrides = []): ServiceRequest
{
    $eventType = EventType::firstOrCreate(['event_type_name' => 'Wedding']);

    return ServiceRequest::create(array_merge([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => $eventType->event_type_id,
        'request_date' => '2026-11-14',
        'start_date' => '2027-01-16',
        'end_date' => '2027-01-16',
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Grand Palace Events Hall, Quezon City',
        'guest_count' => 150,
        'budget_min' => 250000,
        'budget_max' => 500000,
    ], $overrides));
}

test('the tables follow the ERD column names', function () {
    expect(Schema::getColumnListing('customer'))->toEqualCanonicalizing([
        'customer_id', 'user_id', 'first_name', 'last_name', 'contact_number', 'address', 'created_at', 'updated_at',
    ]);
    expect(Schema::getColumnListing('service_requests'))->toEqualCanonicalizing([
        'service_request_id', 'customer_id', 'request_type', 'event_type_id', 'project_title', 'request_date',
        'start_date', 'end_date', 'event_start_time', 'event_end_time', 'venue', 'guest_count', 'budget_min',
        'budget_max', 'project_description', 'request_status', 'pm_remarks', 'reviewed_at', 'created_at', 'updated_at',
        'request_code', // "REQ-26-0001"
    ]);
    expect(Schema::getColumnListing('service_request_files'))->toEqualCanonicalizing([
        'request_file_id', 'service_request_id', 'file_name', 'file_path', 'uploaded_at',
    ]);
    expect(Schema::getColumnListing('service_request_services'))->toEqualCanonicalizing([
        'request_service_id', 'service_request_id', 'service_id', 'quantity', 'unit_price', 'subtotal',
    ]);
});

test('a customer profile belongs to one user account, once', function () {
    $user = User::factory()->create();

    $customer = newCustomerProfile(['user_id' => $user->id]);

    expect($customer->user->is($user))->toBeTrue()
        ->and($customer->full_name)->toBe('Andrea Santos')
        ->and($customer->address)->toBeNull();

    expect(fn () => newCustomerProfile(['user_id' => $user->id]))->toThrow(QueryException::class);
});

test('a standard request is saved as pending with its date, times, guests and budget', function () {
    $customer = newCustomerProfile();

    $request = newStandardRequest($customer)->fresh();

    expect($request->request_status)->toBe(ServiceRequest::STATUS_PENDING)
        ->and($request->isCustom())->toBeFalse()
        ->and($request->start_date->toDateString())->toBe('2027-01-16')
        ->and($request->end_date->toDateString())->toBe('2027-01-16')
        ->and(substr($request->event_start_time, 0, 5))->toBe('14:00')
        ->and($request->guest_count)->toBe(150)
        ->and($request->budget_min)->toBe('250000.00')
        ->and($request->budget_max)->toBe('500000.00')
        ->and($request->customer->is($customer))->toBeTrue()
        ->and($request->eventType->event_type_name)->toBe('Wedding');
});

test('a custom project needs no event type, times or guest count, and can run several days', function () {
    $customer = newCustomerProfile();

    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_CUSTOM,
        'project_title' => 'Christmas mall center display',
        'request_date' => '2026-11-14',
        'start_date' => '2026-12-01',
        'end_date' => '2026-12-31',
        'venue' => 'SM Mall, Main Atrium',
        'budget_min' => 500000, // "Above ₱500,000" has no maximum
    ])->fresh();

    expect($request->isCustom())->toBeTrue()
        ->and($request->eventType)->toBeNull()
        ->and($request->event_start_time)->toBeNull()
        ->and($request->event_end_time)->toBeNull()
        ->and($request->guest_count)->toBeNull()
        ->and($request->budget_max)->toBeNull()
        ->and($request->start_date->toDateString())->toBe('2026-12-01')
        ->and($request->end_date->toDateString())->toBe('2026-12-31');
});

test('a request must belong to an existing customer', function () {
    expect(fn () => newStandardRequest(newCustomerProfile(), ['customer_id' => 9999]))->toThrow(QueryException::class);
});

test('the budget ranges are numbers, and only the last one has no maximum', function () {
    $ranges = ServiceRequest::BUDGET_RANGES;

    expect($ranges['Below ₱50,000'])->toBe([0, 50000])
        ->and($ranges['₱50,000 – ₱100,000'])->toBe([50000, 100000])
        ->and($ranges['Above ₱500,000'])->toBe([500000, null])
        ->and(collect($ranges)->filter(fn ($range) => $range[1] === null))->toHaveCount(1);
});

test('services keep the price they had when the request was saved, once per request', function () {
    $service = Service::create(['service_name' => 'Event Styling', 'service_category' => 'Styling', 'price' => 45000]);
    $request = newStandardRequest(newCustomerProfile());

    $line = ServiceRequestService::create([
        'service_request_id' => $request->service_request_id,
        'service_id' => $service->service_id,
        'quantity' => 1,
        'unit_price' => $service->price,
        'subtotal' => 45000,
    ]);

    $service->update(['price' => 60000]);

    expect($line->fresh()->unit_price)->toBe('45000.00')
        ->and($line->fresh()->subtotal)->toBe('45000.00')
        ->and($line->service->is($service))->toBeTrue()
        ->and($request->services)->toHaveCount(1);

    expect(fn () => ServiceRequestService::create([
        'service_request_id' => $request->service_request_id,
        'service_id' => $service->service_id,
        'quantity' => 1,
        'unit_price' => 45000,
        'subtotal' => 45000,
    ]))->toThrow(QueryException::class);
});

test('reference files are saved with their upload time', function () {
    $request = newStandardRequest(newCustomerProfile());

    $file = $request->files()->create(['file_name' => 'arch-inspiration.jpg', 'file_path' => 'requests/1/arch-inspiration.jpg']);

    expect($file->fresh()->uploaded_at)->not->toBeNull()
        ->and($request->files)->toHaveCount(1)
        ->and($file->serviceRequest->is($request))->toBeTrue();
});

test('the database seeder gives the test customer account a profile, only once', function () {
    $this->seed(DatabaseSeeder::class);

    $customer = Customer::firstOrFail();

    expect(Customer::count())->toBe(1)
        ->and($customer->user->email)->toBe('customer@example.com');

    $this->seed(CustomerSeeder::class);

    expect(Customer::count())->toBe(1);
});

test('the Mall Activation event type and its themes are switched off, not deleted', function () {
    $mall = EventType::create(['event_type_name' => 'Mall Activation']);
    $theme = DesignTheme::create([
        'theme_name' => 'Mall Display Booth', 'event_type_id' => $mall->event_type_id,
        'max_guests' => 1000, 'venue' => 'indoor', 'style' => 'Modern',
    ]);
    $wedding = EventType::create(['event_type_name' => 'Wedding']);

    $migration = require database_path('migrations/2026_11_14_000005_retire_mall_activation_event_type.php');
    $migration->up();

    expect($mall->fresh()->status)->toBe('inactive')
        ->and($theme->fresh()->status)->toBe('inactive')
        ->and($wedding->fresh()->status)->toBe('active');
});