<?php

use App\Enums\Role;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->seed(ServiceAssetSeeder::class);
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function validService(array $overrides = []): array
{
    return array_merge([
        'name' => 'Lights and Sound',
        'category' => 'Entertainment',
        'description' => 'Stage lights and speakers.',
        'pricingType' => 'fixed',
        'unitType' => '',
        'price' => '12000',
        'active' => true,
    ], $overrides);
}

function baseFee(): Service
{
    return Service::where('service_name', Service::BASE_FEE_NAME)->firstOrFail();
}

test('only the Technical Admin can open or change services', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get(route('technical-admin.services-assets'))->assertForbidden();
    $this->actingAs($user)->post(route('technical-admin.services-assets.services.store'), validService())->assertForbidden();
})->with([Role::Customer, Role::ProjectManager, Role::Owner]);

test('the screen lists the services with the Event Styling fee first', function () {
    $this->actingAs($this->admin)
        ->get(route('technical-admin.services-assets'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('technical-admin/services-assets')
            ->has('services', 7)
            ->where('services.0.name', 'Event Styling')
            ->where('services.0.isBaseFee', true)
            ->where('services.0.price', fn ($price) => (float) $price === 45000.0)
            ->where('services.1.isBaseFee', false)
            ->where('categories', Service::CATEGORIES)
            ->where('unitTypes', Service::UNIT_TYPES)
        );
});

test('a service can be added', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.services.store'), validService())
        ->assertRedirect(route('technical-admin.services-assets'))
        ->assertSessionHasNoErrors();

    $service = Service::where('service_name', 'Lights and Sound')->firstOrFail();

    expect($service->service_category)->toBe('Entertainment')
        ->and($service->pricing_type)->toBe('fixed')
        ->and($service->unit_type)->toBeNull()
        ->and($service->price)->toBe('12000.00')
        ->and($service->isActive())->toBeTrue();
});

test('a per-unit service needs a unit type, and a fixed one drops it', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.services.store'), validService(['pricingType' => 'per_unit', 'unitType' => '']))
        ->assertSessionHasErrors(['unitType' => 'Choose a unit type.']);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.services.store'), validService(['pricingType' => 'per_unit', 'unitType' => 'hour', 'price' => '2500.50']))
        ->assertSessionHasNoErrors();

    $service = Service::where('service_name', 'Lights and Sound')->firstOrFail();

    expect($service->unit_type)->toBe('hour')
        ->and($service->price)->toBe('2500.50');

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.update', $service), validService(['unitType' => 'hour']))
        ->assertSessionHasNoErrors();

    expect($service->fresh()->unit_type)->toBeNull();
});

test('incomplete or invalid services are not saved', function (array $override, string $error) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.services.store'), validService($override))
        ->assertSessionHasErrors($error);

    expect(Service::count())->toBe(7);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'missing description' => [['description' => ''], 'description'],
    'missing price' => [['price' => ''], 'price'],
    'zero price' => [['price' => '0'], 'price'],
    'three decimals' => [['price' => '10.555'], 'price'],
    'unknown category' => [['category' => 'Fireworks'], 'category'],
    'reserved Styling category' => [['category' => 'Styling'], 'category'],
    'unknown unit' => [['pricingType' => 'per_unit', 'unitType' => 'kg'], 'unitType'],
    'unknown pricing type' => [['pricingType' => 'hourly'], 'pricingType'],
]);

test('service names are unique regardless of case, and Event Styling is reserved', function (string $name) {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.services-assets.services.store'), validService(['name' => $name]))
        ->assertSessionHasErrors(['name' => 'A service with this name already exists.']);
})->with(['DJ Services', 'dj services', 'Event Styling', 'event styling']);

test('a service can be edited and keeps its own name', function () {
    $dj = Service::where('service_name', 'DJ Services')->firstOrFail();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.update', $dj), validService([
            'name' => 'DJ Services',
            'price' => '18000',
            'active' => false,
        ]))
        ->assertSessionHasNoErrors();

    $dj->refresh();

    expect($dj->price)->toBe('18000.00')
        ->and($dj->description)->toBe('Stage lights and speakers.')
        ->and($dj->isActive())->toBeFalse();
});

test('a service can be switched off and on, and nothing is deleted', function () {
    $dj = Service::where('service_name', 'DJ Services')->firstOrFail();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.status', $dj), ['active' => false])
        ->assertRedirect(route('technical-admin.services-assets'));

    expect($dj->fresh()->isActive())->toBeFalse();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.status', $dj), ['active' => true]);

    expect($dj->fresh()->isActive())->toBeTrue()
        ->and(Service::count())->toBe(7);
});

test('the Event Styling fee only allows its description and price to change', function () {
    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.update', baseFee()), [
            'name' => 'Cheap Styling',
            'category' => 'Host',
            'description' => 'Updated styling package.',
            'pricingType' => 'per_unit',
            'unitType' => 'pax',
            'price' => '50000',
            'active' => false,
        ])
        ->assertSessionHasNoErrors();

    $fee = baseFee();

    expect($fee->service_name)->toBe('Event Styling')
        ->and($fee->service_category)->toBe('Styling')
        ->and($fee->pricing_type)->toBe('fixed')
        ->and($fee->unit_type)->toBeNull()
        ->and($fee->isActive())->toBeTrue()
        ->and($fee->description)->toBe('Updated styling package.')
        ->and($fee->price)->toBe('50000.00');
});

test('the Event Styling fee still needs a valid price and description', function () {
    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.update', baseFee()), ['description' => '', 'price' => '0'])
        ->assertSessionHasErrors(['description', 'price']);

    expect(baseFee()->price)->toBe('45000.00');
});

test('the Event Styling fee cannot be switched off', function () {
    $this->actingAs($this->admin)
        ->patch(route('technical-admin.services-assets.services.status', baseFee()), ['active' => false])
        ->assertForbidden();

    expect(baseFee()->isActive())->toBeTrue();
});