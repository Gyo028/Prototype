<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Customer > My Projects > Request Details / Project Details:
 * everything the customer submitted, and its reference files.
 */

beforeEach(function () {
    $this->withoutVite();
    $this->seed(DatabaseSeeder::class);
    $this->customer = User::where('email', Role::Customer->value.'@example.com')->firstOrFail();
});

function rdPending(): ServiceRequest
{
    return ServiceRequest::where('request_status', ServiceRequest::STATUS_PENDING)->doesntHave('project')->firstOrFail();
}

function rdApproved(): ServiceRequest
{
    return ServiceRequest::has('project')->where('request_type', ServiceRequest::TYPE_STANDARD)->firstOrFail();
}

test('a pending request shows as Request Details, with its services and reservation fee', function () {
    $r = rdPending();

    $this->actingAs($this->customer)->get("/customer/requests/{$r->service_request_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('customer/request-show')
            ->where('project', null)
            ->where('request.requestStatus', 'pending')
            // JSON sends whole numbers without ".0", so compare by value.
            ->where('request.reservationFee', fn ($v) => (float) $v === $r->reservationFee())
            ->has('request.services', 1) // the Event Styling base fee
            ->where('request.services.0.name', 'Event Styling')
            ->where('request.servicesTotal', fn ($v) => (float) $v === 10000.0));
});

test('a standard request shows its preliminary layout and the initial quotation with the assets', function () {
    // The sample pending request: a debut for 100 guests, Debut Glam's default set left as is.
    $r = rdPending();

    $this->actingAs($this->customer)->get("/customer/requests/{$r->service_request_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('layout.theme.name', 'Debut Glam')
            ->has('layout.items', 5)
            ->where('layout.items.0.name', 'Backdrop Panel')
            ->where('layout.items.0.isDefault', true)
            ->where('layout.items.1.name', 'Chiavari Chairs')
            ->where('layout.items.1.quantity', 100)
            ->where('layout.items.1.perGuest', true)
            ->where('layout.items.2.name', 'Cocktail Tables')
            ->where('layout.items.2.quantity', 10)
            ->where('layout.toBePriced', 0)
            // 8,000 + 4,500 + 3,500 + 2,500 + 3,500 of assets
            ->where('layout.assetsTotal', fn ($v) => (float) $v === 22000.0)
            // with the ₱10,000 Event Styling fee
            ->where('layout.total', fn ($v) => (float) $v === 32000.0));
});

test('an "Other" item shows as to be priced', function () {
    $r = rdPending();
    $r->preliminaryLayout->items()->create([
        'custom_item_category' => 'Decors', 'custom_item_name' => 'Neon sign', 'custom_item_description' => 'Pink, 1 m',
    ]);

    $this->actingAs($this->customer)->get("/customer/requests/{$r->service_request_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->has('layout.items', 6)
            ->where('layout.items.5.name', 'Neon sign')
            ->where('layout.items.5.isCustom', true)
            ->where('layout.items.5.unitPrice', null)
            ->where('layout.items.5.subtotal', null)
            ->where('layout.toBePriced', 1));
});

test('a custom project has no layout', function () {
    $r = ServiceRequest::where('request_type', ServiceRequest::TYPE_CUSTOM)->firstOrFail();

    $this->actingAs($this->customer)->get("/customer/requests/{$r->service_request_id}")
        ->assertInertia(fn (Assert $page) => $page->where('layout', null));
});

test('an approved request shows as Project Details, linked to its project', function () {
    $r = rdApproved();

    $this->actingAs($this->customer)->get("/customer/requests/{$r->service_request_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('project.id', $r->project->project_id)
            ->where('project.code', $r->project->project_code)
            ->has('project.status.name'));
});

test('the project page links back to its details page', function () {
    $r = rdApproved();

    customerProjectPage($this->actingAs($this->customer), $r->project)
        ->assertInertia(fn (Assert $page) => $page->where('project.requestId', $r->service_request_id));
});

test('another customer cannot see the request or its files', function () {
    $otherUser = User::factory()->create(['role' => Role::Customer]);
    Customer::create(['user_id' => $otherUser->id, 'first_name' => 'Jo', 'last_name' => 'Cruz', 'contact_number' => '09170000000']);
    $r = rdPending();

    $this->actingAs($otherUser)->get("/customer/requests/{$r->service_request_id}")->assertNotFound();
});

test('reference files can be viewed and downloaded, only through their own request', function () {
    Storage::fake();
    $r = rdPending();
    $path = UploadedFile::fake()->create('peg.jpg', 100, 'image/jpeg')->store("customers/{$r->customer_id}/requests/{$r->service_request_id}");
    $file = $r->files()->create(['file_name' => 'peg.jpg', 'file_path' => $path]);

    $url = "/customer/requests/{$r->service_request_id}/files/{$file->request_file_id}";

    $this->actingAs($this->customer)->get("/customer/requests/{$r->service_request_id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.files.0.url', $url)
            ->where('request.files.0.isImage', true));

    $this->actingAs($this->customer)->get($url)->assertOk();
    expect($this->actingAs($this->customer)->get("{$url}?download=1")->headers->get('content-disposition'))->toContain('attachment');

    // The same file through another request's URL.
    $other = rdApproved();
    $this->actingAs($this->customer)->get("/customer/requests/{$other->service_request_id}/files/{$file->request_file_id}")->assertNotFound();
});
