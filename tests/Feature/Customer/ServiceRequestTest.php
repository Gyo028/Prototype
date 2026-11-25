<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\DesignTheme;
use App\Models\EventType;
use App\Models\LayoutAsset;
use App\Models\PreliminaryLayoutItem;
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
        'contact_number' => uniqueMobile(),
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

function srThemeId(string $name = 'Garden Romance'): int
{
    return DesignTheme::where('theme_name', $name)->value('theme_id');
}

function srAssetId(string $name): int
{
    return LayoutAsset::where('asset_name', $name)->value('asset_id');
}

/** The saved layout items by name: [quantity, unit price, subtotal, is default]. */
function srLayoutLines(ServiceRequest $request): array
{
    return $request->preliminaryLayout->items()->with('asset')->orderBy('layout_item_id')->get()
        ->mapWithKeys(fn (PreliminaryLayoutItem $i) => [
            $i->asset?->asset_name ?? $i->custom_item_name => [$i->quantity, $i->unit_price, $i->subtotal, $i->is_default],
        ])->all();
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
                ->and((float) $props['baseFee']['price'])->toBe(10000.0)
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

test('a customer without a contact number is sent to My Profile and cannot submit', function () {
    // No profile row at all (an account from before profiles were made at registration)…
    $noProfile = User::factory()->create(['role' => Role::Customer]);
    // …and a profile from registration, without a contact number yet.
    $newCustomer = User::factory()->create(['role' => Role::Customer]);
    Customer::create(['user_id' => $newCustomer->id, 'first_name' => 'Jo', 'last_name' => 'Cruz']);

    foreach ([$noProfile, $newCustomer] as $user) {
        $this->actingAs($user)->get(route('customer.new-request'))->assertRedirect(route('customer.profile'));
        $this->actingAs($user)->post(route('customer.new-request.store'), srStandard())->assertRedirect(route('customer.profile'));
    }

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

    expect($lines['Event Styling']->subtotal)->toBe('10000.00')
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

/* ---------------- Exact budget ---------------- */

test('an exact budget is saved as one amount, in place of a range', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['budget' => 'exact', 'budgetExact' => '180000']))
        ->assertSessionHasNoErrors();

    $request = ServiceRequest::firstOrFail();

    expect($request->budget_min)->toBe('180000.00')
        ->and($request->budget_max)->toBe('180000.00')
        ->and($request->hasExactBudget())->toBeTrue();
});

test('an exact budget must be given, and be at least ₱10,000 (standard) or ₱50,000 (custom)', function (Closure $data, string $error) {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), $data())
        ->assertSessionHasErrors($error);

    expect(ServiceRequest::count())->toBe(0);
})->with([
    'no amount' => [fn () => srStandard(['budget' => 'exact', 'budgetExact' => '']), 'budgetExact'],
    'standard below ₱10,000' => [fn () => srStandard(['budget' => 'exact', 'budgetExact' => '9999']), 'budgetExact'],
    'custom below ₱50,000' => [fn () => srCustom(['budget' => 'exact', 'budgetExact' => '49999']), 'budgetExact'],
    'three decimals' => [fn () => srStandard(['budget' => 'exact', 'budgetExact' => '20000.555']), 'budgetExact'],
]);

test('a custom project\'s reservation fee is 10% of its exact budget', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srCustom(['budget' => 'exact', 'budgetExact' => '120000']))
        ->assertSessionHasNoErrors();

    $request = ServiceRequest::firstOrFail();

    expect($request->reservationFee())->toBe(12000.0)
        ->and($request->reservationFeeBasis())->toBe('your budget');
});

test('a standard request\'s reservation fee is 10% of its initial quotation, whatever the budget', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['serviceIds' => [], 'themeId' => srThemeId(), 'budget' => 'Above ₱500,000']))
        ->assertSessionHasNoErrors();

    $request = ServiceRequest::firstOrFail();

    // Initial quotation: ₱10,000 fee + ₱31,500 of the default set = ₱41,500.
    expect($request->reservationFee())->toBe(4150.0)
        ->and($request->reservationFeeBasis())->toBe('your initial quotation');
});

/* ---------------- Preliminary layout ---------------- */

test('the form gets each theme\'s default set and only priced, switched-on assets with their prices', function () {
    LayoutAsset::where('asset_name', 'Uplighting')->update(['price' => null]);

    $this->actingAs($this->user)
        ->get(route('customer.new-request'))
        ->assertInertia(function (Assert $page) {
            $all = $page->toArray();
            $props = $all['props'] ?? $all;
            $garden = collect($props['themes'])->firstWhere('name', 'Garden Romance');
            $chairs = collect($props['assets'])->firstWhere('name', 'Chiavari Chairs');

            expect(collect($props['assets'])->pluck('name')->all())->not->toContain('Uplighting')
                ->and(array_column($garden['slots'], 'key'))->toBe(['backdrop', 'seating', 'tables', 'lighting', 'centerpieces'])
                ->and($garden['slots'][1]['defaultAssetId'])->toBe(srAssetId('Chiavari Chairs'))
                ->and((float) $chairs['price'])->toBe(45.0)
                ->and($chairs['pricingType'])->toBe('per_guest')
                ->and($chairs['guestsPerUnit'])->toBe(1);
        });
});

test('nothing picked: the Event Styling fee alone and the theme\'s full default set', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['serviceIds' => [], 'themeId' => srThemeId()]))
        ->assertSessionHasNoErrors();

    $request = ServiceRequest::with('services.service', 'preliminaryLayout')->firstOrFail();
    $lines = srLayoutLines($request);

    // 150 guests: chairs one each, tables and centerpieces one per 10.
    expect($request->services)->toHaveCount(1)
        ->and($request->services[0]->service->service_name)->toBe('Event Styling')
        ->and($request->preliminaryLayout->theme_id)->toBe(srThemeId())
        ->and($request->preliminaryLayout->layout_status)->toBe('submitted')
        ->and($request->preliminaryLayout->generated_at)->not->toBeNull()
        ->and($lines)->toBe([
            'Backdrop Panel' => [1, '8000.00', '8000.00', true],
            'Chiavari Chairs' => [150, '45.00', '6750.00', true],
            'Cocktail Tables' => [15, '350.00', '5250.00', true],
            'Fairy Lights' => [1, '2500.00', '2500.00', true],
            'Floral Centerpieces' => [15, '600.00', '9000.00', true],
        ])
        // ₱10,000 fee + ₱31,500 of assets
        ->and($request->preliminaryLayout->total_initial_cost)->toBe('41500.00');
});

test('the ticked assets and "Other" items are saved, and the total adds services and priced assets', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard([
            'themeId' => srThemeId(),
            // Two defaults kept, the rest unticked, two others ticked.
            'assetIds' => [srAssetId('Chiavari Chairs'), srAssetId('Backdrop Panel'), srAssetId('Entrance Arch'), srAssetId('Uplighting')],
            'customItems' => [['category' => 'Decors', 'name' => 'Neon name sign', 'description' => 'Warm white, "Ana & Ben", 1 m wide']],
        ]))
        ->assertSessionHasNoErrors();

    $request = ServiceRequest::with('preliminaryLayout.items')->firstOrFail();
    $lines = srLayoutLines($request);

    expect(array_keys($lines))->toBe(['Chiavari Chairs', 'Backdrop Panel', 'Entrance Arch', 'Uplighting', 'Neon name sign'])
        ->and($lines['Chiavari Chairs'])->toBe([150, '45.00', '6750.00', true])      // a default the customer kept
        ->and($lines['Backdrop Panel'][3])->toBeTrue()
        ->and($lines['Entrance Arch'])->toBe([1, '6500.00', '6500.00', false])        // not in the theme's set
        ->and($lines['Uplighting'])->toBe([1, '4000.00', '4000.00', false])
        ->and($lines['Neon name sign'])->toBe([1, null, null, false])                 // to be priced
        ->and($request->preliminaryLayout->items->firstWhere('custom_item_name', 'Neon name sign')->custom_item_category)->toBe('Decors')
        // services ₱10,000 + ₱15,000 + ₱97,500; assets 6,750 + 8,000 + 6,500 + 4,000
        ->and($request->preliminaryLayout->total_initial_cost)->toBe((string) number_format(122500 + 25250, 2, '.', ''));
});

test('only switched-on, priced assets can be ticked, each once', function (Closure $picks, string $error) {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard($picks() + ['themeId' => srThemeId()])) // a dataset's own themeId wins
        ->assertSessionHasErrors($error);

    expect(ServiceRequest::count())->toBe(0);
})->with([
    'unknown asset' => [fn () => ['assetIds' => [99999]], 'assetIds.0'],
    'switched off' => [function () {
        LayoutAsset::where('asset_name', 'Entrance Arch')->update(['status' => 'inactive']);

        return ['assetIds' => [srAssetId('Entrance Arch')]];
    }, 'assetIds.0'],
    'unpriced' => [function () {
        LayoutAsset::where('asset_name', 'Uplighting')->update(['price' => null]);

        return ['assetIds' => [srAssetId('Backdrop Panel'), srAssetId('Uplighting')]];
    }, 'assetIds.1'],
    'twice' => [fn () => ['assetIds' => [srAssetId('Entrance Arch'), srAssetId('Entrance Arch')]], 'assetIds.1'],
    'theme of another event type' => [fn () => ['themeId' => srThemeId('Debut Glam')], 'themeId'],
    '"Other" item without a name' => [fn () => ['customItems' => [['category' => 'Decors', 'name' => '', 'description' => 'Big']]], 'customItems.0.name'],
    '"Other" item without a description' => [fn () => ['customItems' => [['category' => 'Decors', 'name' => 'Sign', 'description' => '']]], 'customItems.0.description'],
    '"Other" item in an unknown category' => [fn () => ['customItems' => [['category' => 'Fireworks', 'name' => 'Sign', 'description' => 'Big']]], 'customItems.0.category'],
]);

test('a default asset that is switched off is replaced by another of its category', function () {
    LayoutAsset::where('asset_name', 'Backdrop Panel')->update(['status' => 'inactive']);

    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['themeId' => srThemeId()]))
        ->assertSessionHasNoErrors();

    $lines = srLayoutLines(ServiceRequest::firstOrFail());

    expect($lines)->not->toHaveKey('Backdrop Panel')
        ->and($lines['Entrance Arch'][3])->toBeTrue(); // stands in for the backdrop slot
});

test('a request keeps the asset prices of the day it was sent', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['themeId' => srThemeId()]))
        ->assertSessionHasNoErrors();

    LayoutAsset::where('asset_name', 'Backdrop Panel')->update(['price' => 12000]);

    expect(srLayoutLines(ServiceRequest::firstOrFail())['Backdrop Panel'])->toBe([1, '8000.00', '8000.00', true]);
});

test('without a theme, the layout has only the ticked assets', function () {
    $this->actingAs($this->user)
        ->post(route('customer.new-request.store'), srStandard(['assetIds' => [srAssetId('Entrance Arch')]]))
        ->assertSessionHasNoErrors();

    $request = ServiceRequest::firstOrFail();

    expect($request->preliminaryLayout->theme_id)->toBeNull()
        ->and(array_keys(srLayoutLines($request)))->toBe(['Entrance Arch']);
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
        ->and($request->services)->toHaveCount(0)
        ->and($request->preliminaryLayout)->toBeNull(); // no layout: quoted after the design proposal
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
        expect($file->file_path)->toStartWith("customers/{$serviceRequest->customer_id}/requests/{$serviceRequest->service_request_id}/");
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

test('the full-screen layout view opens for customers', function () {
    $this->actingAs($this->user)
        ->get(route('customer.layout-view'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('customer/layout-view'));
});
