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
            ->where('request.servicesTotal', fn ($v) => (float) $v === 45000.0));
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

    $this->actingAs($this->customer)->get("/customer/projects/{$r->project->project_id}")
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
    $path = UploadedFile::fake()->create('peg.jpg', 100, 'image/jpeg')->store("service-requests/{$r->service_request_id}");
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
