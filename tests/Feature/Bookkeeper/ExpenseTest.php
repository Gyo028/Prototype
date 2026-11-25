<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\EmployeePosition;
use App\Models\EventType;
use App\Models\Project;
use App\Models\ProjectExpense;
use App\Models\ProjectExpenseHistory;
use App\Models\ProjectStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\ServiceAssetSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * Bookkeeper > Expenses: recording, editing, archiving and restoring project
 * expenses, with a change trail the Bookkeeper, Owner and Project Manager can see.
 * "Today" is Saturday, Nov 21, 2026 (Manila). The project is still at the
 * Consultation step, since expenses can be logged at any step.
 */

beforeEach(function () {
    $this->withoutVite();
    Storage::fake();
    $this->seed(ServiceAssetSeeder::class);
    Carbon::setTestNow(Carbon::parse('2026-11-21 10:00', 'Asia/Manila'));

    $this->bookkeeper = User::factory()->create(['role' => Role::Bookkeeper, 'name' => 'Bea Bookkeeper']);
    $this->project = expProject();
});

afterEach(fn () => Carbon::setTestNow());

/** A Wedding project at the Consultation step. */
function expProject(): Project
{
    $user = User::factory()->create(['role' => Role::Customer]);
    $customer = Customer::create([
        'user_id' => $user->id,
        'first_name' => 'Andrea',
        'last_name' => 'Santos',
        'contact_number' => uniqueMobile(),
    ]);

    $request = ServiceRequest::create([
        'customer_id' => $customer->customer_id,
        'request_type' => ServiceRequest::TYPE_STANDARD,
        'event_type_id' => EventType::where('event_type_name', 'Wedding')->value('event_type_id'),
        'request_date' => '2026-11-01',
        'start_date' => '2027-01-16',
        'end_date' => '2027-01-16',
        'event_start_time' => '14:00',
        'event_end_time' => '22:00',
        'venue' => 'Garden Pavilion, Tagaytay',
        'guest_count' => 150,
        'budget_min' => 100000,
        'budget_max' => 250000,
        'request_status' => ServiceRequest::STATUS_APPROVED,
    ]);

    $manager = Employee::query()->first() ?? Employee::create([
        'position_id' => EmployeePosition::where('position_name', 'Project Manager')->value('position_id'),
        'first_name' => 'Paolo',
        'last_name' => 'Reyes',
        'contact_number' => '09181112222',
        'email' => 'pm@example.com',
    ]);

    return Project::create([
        'service_request_id' => $request->service_request_id,
        'project_manager_id' => $manager->employee_id,
        'current_status_id' => ProjectStatus::idFor(ProjectStatus::CONSULTATION),
    ])->fresh();
}

function expPayload(Project $project, array $overrides = []): array
{
    return array_merge([
        'project_id' => $project->project_id,
        'expense_type' => 'transportation',
        'amount' => '1500',
        'expense_date' => '2026-11-20',
        'description' => 'Van rental for the ocular visit',
    ], $overrides);
}

function expReceipt(string $name = 'receipt.pdf', int $kb = 300, string $mime = 'application/pdf'): UploadedFile
{
    return UploadedFile::fake()->create($name, $kb, $mime);
}

/** Records an expense as the Bookkeeper and returns it. */
function expRecord($test, array $overrides = []): ProjectExpense
{
    $test->actingAs($test->bookkeeper)
        ->post('/bookkeeper/expenses', expPayload($test->project, $overrides))
        ->assertRedirect('/bookkeeper/expenses')
        ->assertSessionHasNoErrors();

    return ProjectExpense::latest('expense_id')->firstOrFail();
}

/** @return list<string> the actions in the trail, oldest first */
function expActions(ProjectExpense $expense): array
{
    return $expense->histories()->orderBy('history_id')->pluck('action')->all();
}

/* ---------------- Access ---------------- */

test('the Bookkeeper sees the Expenses page with real projects and the five categories', function () {
    $this->actingAs($this->bookkeeper)->get('/bookkeeper/expenses')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('bookkeeper/expenses')
            ->has('expenses', 0)
            ->has('projects', 1)
            ->where('projects.0.id', $this->project->project_id)
            ->where('projects.0.label', $this->project->project_code.' · Wedding')
            ->where('projects.0.status', ProjectStatus::CONSULTATION)
            ->has('categories', 5)
            ->where('today', '2026-11-21')
            ->where('receiptRules.maxMb', 5));
});

test('other roles cannot open or change the Bookkeeper expenses', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get('/bookkeeper/expenses')->assertForbidden();
    $this->actingAs($user)->post('/bookkeeper/expenses', expPayload($this->project))->assertForbidden();

    expect(ProjectExpense::count())->toBe(0);
})->with([Role::Customer, Role::ProjectManager, Role::Owner, Role::TechnicalAdmin]);

test('guests are sent to the login page', function () {
    $this->get('/bookkeeper/expenses')->assertRedirect(route('login'));
});

/* ---------------- Recording ---------------- */

test('an expense can be recorded with a receipt, on a project at any step', function () {
    $expense = expRecord($this, ['receipt' => expReceipt('OR-1001.pdf')]);

    expect($expense->project_id)->toBe($this->project->project_id)
        ->and($expense->expense_type->value)->toBe('transportation')
        ->and($expense->amount)->toBe('1500.00')
        ->and($expense->expense_date->toDateString())->toBe('2026-11-20')
        ->and($expense->recorded_by)->toBe($this->bookkeeper->id)
        ->and($expense->archived_at)->toBeNull()
        ->and($expense->receipt_file_name)->toBe('OR-1001.pdf')
        ->and(expActions($expense))->toBe([
            ProjectExpenseHistory::ACTION_CREATED,
            ProjectExpenseHistory::ACTION_RECEIPT_ATTACHED,
        ]);

    Storage::assertExists($expense->receipt_file_path);
    expect($expense->receipt_file_path)->toStartWith("expenses/projects/{$this->project->project_id}/{$expense->expense_id}/");
});

test('the receipt is optional and the expense shows as missing one', function () {
    $expense = expRecord($this);

    expect($expense->receipt_file_path)->toBeNull()
        ->and(expActions($expense))->toBe([ProjectExpenseHistory::ACTION_CREATED]);

    $this->actingAs($this->bookkeeper)->get('/bookkeeper/expenses')
        ->assertInertia(fn (Assert $page) => $page
            ->has('expenses', 1)
            ->where('expenses.0.receipt', null)
            ->where('expenses.0.categoryLabel', 'Transportation')
            ->where('expenses.0.recordedBy', 'Bea Bookkeeper'));
});

test('invalid expenses are rejected', function (array $data, string $field) {
    $this->actingAs($this->bookkeeper)
        ->post('/bookkeeper/expenses', expPayload($this->project, $data))
        ->assertSessionHasErrors($field);

    expect(ProjectExpense::count())->toBe(0);
})->with([
    'no project' => [['project_id' => ''], 'project_id'],
    'unknown project' => [['project_id' => 99999], 'project_id'],
    'unknown category' => [['expense_type' => 'food'], 'expense_type'],
    'zero amount' => [['amount' => '0'], 'amount'],
    'amount not a number' => [['amount' => 'abc'], 'amount'],
    'future date' => [['expense_date' => '2026-11-22'], 'expense_date'],
    'wrong date format' => [['expense_date' => '11/20/2026'], 'expense_date'],
    'no description' => [['description' => ''], 'description'],
    'description too long' => [['description' => str_repeat('a', 256)], 'description'],
    'receipt over 5 MB' => [['receipt' => expReceipt('big.pdf', 5121)], 'receipt'],
    'receipt not PDF/JPG/PNG' => [['receipt' => expReceipt('receipt.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')], 'receipt'],
]);

test('today counts as a valid date in Manila time', function () {
    // 00:30 on Nov 22 in Manila is still Nov 21 in UTC.
    Carbon::setTestNow(Carbon::parse('2026-11-22 00:30', 'Asia/Manila'));

    expRecord($this, ['expense_date' => '2026-11-22']);

    expect(ProjectExpense::count())->toBe(1);
});

/* ---------------- Editing and the trail ---------------- */

test('editing logs only the fields that changed, with old and new values', function () {
    $expense = expRecord($this);

    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($this->project, [
            'amount' => '1800',
            'description' => 'Van rental and toll for the ocular visit',
        ]))
        ->assertRedirect('/bookkeeper/expenses')
        ->assertSessionHasNoErrors();

    $expense->refresh();
    $edit = $expense->histories()->where('action', ProjectExpenseHistory::ACTION_UPDATED)->sole();

    expect($expense->amount)->toBe('1800.00')
        ->and($edit->changed_by)->toBe($this->bookkeeper->id)
        ->and($edit->changes)->toBe([
            'amount' => ['old' => '1500.00', 'new' => '1800.00'],
            'description' => ['old' => 'Van rental for the ocular visit', 'new' => 'Van rental and toll for the ocular visit'],
        ]);
});

test('saving without changes adds nothing to the trail', function () {
    $expense = expRecord($this);

    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($this->project, ['amount' => '1500.00']))
        ->assertRedirect('/bookkeeper/expenses');

    expect(expActions($expense))->toBe([ProjectExpenseHistory::ACTION_CREATED]);
});

test('moving an expense to another project is logged', function () {
    $expense = expRecord($this);
    $other = expProject();

    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($other))
        ->assertSessionHasNoErrors();

    $edit = $expense->histories()->where('action', ProjectExpenseHistory::ACTION_UPDATED)->sole();

    expect($expense->fresh()->project_id)->toBe($other->project_id)
        ->and($edit->changes)->toBe([
            'project_id' => ['old' => (string) $this->project->project_id, 'new' => (string) $other->project_id],
        ]);
});

test('a receipt can be attached later, and replacing it is logged with both file names', function () {
    $expense = expRecord($this);

    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($this->project, ['receipt' => expReceipt('first.pdf')]));
    $firstPath = $expense->fresh()->receipt_file_path;

    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($this->project, ['receipt' => expReceipt('second.png', 200, 'image/png')]));

    $expense->refresh();
    $replaced = $expense->histories()->where('action', ProjectExpenseHistory::ACTION_RECEIPT_REPLACED)->sole();

    expect($expense->receipt_file_name)->toBe('second.png')
        ->and($replaced->changes)->toBe(['receipt' => ['old' => 'first.pdf', 'new' => 'second.png']])
        ->and(expActions($expense))->toBe([
            ProjectExpenseHistory::ACTION_CREATED,
            ProjectExpenseHistory::ACTION_RECEIPT_ATTACHED,
            ProjectExpenseHistory::ACTION_RECEIPT_REPLACED,
        ]);

    // The old file is kept as proof.
    Storage::assertExists($firstPath);
    Storage::assertExists($expense->receipt_file_path);
});

/* ---------------- Archiving ---------------- */

test('archiving keeps the expense but leaves it out of the financial report, and restoring brings it back', function () {
    $expense = expRecord($this);

    $this->actingAs($this->bookkeeper)->patch("/bookkeeper/expenses/{$expense->expense_id}/archive")->assertRedirect();

    expect($expense->fresh()->isArchived())->toBeTrue()
        ->and(ProjectExpense::count())->toBe(1);

    $this->actingAs($this->bookkeeper)->get('/bookkeeper/financial-reports')
        ->assertInertia(fn (Assert $page) => $page->has('transactions', 0));

    $this->actingAs($this->bookkeeper)->get('/bookkeeper/expenses')
        ->assertInertia(fn (Assert $page) => $page->where('expenses.0.archived', true));

    $this->actingAs($this->bookkeeper)->patch("/bookkeeper/expenses/{$expense->expense_id}/restore")->assertRedirect();

    expect($expense->fresh()->isArchived())->toBeFalse()
        ->and(expActions($expense))->toBe([
            ProjectExpenseHistory::ACTION_CREATED,
            ProjectExpenseHistory::ACTION_ARCHIVED,
            ProjectExpenseHistory::ACTION_RESTORED,
        ]);

    $this->actingAs($this->bookkeeper)->get('/bookkeeper/financial-reports')
        ->assertInertia(fn (Assert $page) => $page
            ->has('transactions', 1)
            ->where('transactions.0.category', 'Transportation')
            ->where('transactions.0.amount', 1500));
});

test('archiving twice or restoring an active expense adds nothing to the trail', function () {
    $expense = expRecord($this);

    $this->actingAs($this->bookkeeper)->patch("/bookkeeper/expenses/{$expense->expense_id}/restore");
    $this->actingAs($this->bookkeeper)->patch("/bookkeeper/expenses/{$expense->expense_id}/archive");
    $this->actingAs($this->bookkeeper)->patch("/bookkeeper/expenses/{$expense->expense_id}/archive");

    expect(expActions($expense))->toBe([
        ProjectExpenseHistory::ACTION_CREATED,
        ProjectExpenseHistory::ACTION_ARCHIVED,
    ]);
});

test('an archived expense must be restored before it can be edited', function () {
    $expense = expRecord($this);
    $this->actingAs($this->bookkeeper)->patch("/bookkeeper/expenses/{$expense->expense_id}/archive");

    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($this->project, ['amount' => '9999']))
        ->assertStatus(422);

    expect($expense->fresh()->amount)->toBe('1500.00');
});

/* ---------------- History and receipt for Bookkeeper, Owner, Project Manager ---------------- */

test('the history can be read by the Bookkeeper, Owner and Project Manager, newest first and in readable values', function (Role $role) {
    $expense = expRecord($this);
    $this->actingAs($this->bookkeeper)
        ->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($this->project, ['amount' => '1800', 'expense_type' => 'labor']));

    $viewer = $role === Role::Bookkeeper ? $this->bookkeeper : User::factory()->create(['role' => $role]);

    $this->actingAs($viewer)->getJson("/project-expenses/{$expense->expense_id}/history")
        ->assertOk()
        ->assertJsonPath('expenseId', $expense->expense_id)
        ->assertJsonCount(2, 'history')
        ->assertJsonPath('history.0.label', 'Edited')
        ->assertJsonPath('history.0.by', 'Bea Bookkeeper')
        ->assertJsonPath('history.0.changes', [
            ['field' => 'Category', 'old' => 'Transportation', 'new' => 'Labor'],
            ['field' => 'Amount', 'old' => '₱1,500.00', 'new' => '₱1,800.00'],
        ])
        ->assertJsonPath('history.1.label', 'Recorded')
        ->assertJsonPath('history.1.changes', []);
})->with([Role::Bookkeeper, Role::Owner, Role::ProjectManager]);

test('the history shows project codes instead of IDs', function () {
    $expense = expRecord($this);
    $other = expProject();

    $this->actingAs($this->bookkeeper)->post("/bookkeeper/expenses/{$expense->expense_id}", expPayload($other));

    $this->actingAs($this->bookkeeper)->getJson("/project-expenses/{$expense->expense_id}/history")
        ->assertJsonPath('history.0.changes.0', [
            'field' => 'Project',
            'old' => $this->project->project_code,
            'new' => $other->project_code,
        ]);
});

test('customers and the Technical Admin cannot see the history or the receipt', function (Role $role) {
    $expense = expRecord($this, ['receipt' => expReceipt()]);
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->getJson("/project-expenses/{$expense->expense_id}/history")->assertForbidden();
    $this->actingAs($user)->get("/project-expenses/{$expense->expense_id}/receipt")->assertForbidden();
})->with([Role::Customer, Role::TechnicalAdmin]);

test('the receipt opens for the Owner and downloads with its original name', function () {
    $expense = expRecord($this, ['receipt' => expReceipt('OR-1001.pdf')]);
    $owner = User::factory()->create(['role' => Role::Owner]);

    $this->actingAs($owner)->get("/project-expenses/{$expense->expense_id}/receipt")->assertOk();

    $this->actingAs($owner)->get("/project-expenses/{$expense->expense_id}/receipt?download=1")
        ->assertOk()
        ->assertDownload('OR-1001.pdf');
});

test('an expense without a receipt returns not found', function () {
    $expense = expRecord($this);

    $this->actingAs($this->bookkeeper)->get("/project-expenses/{$expense->expense_id}/receipt")->assertNotFound();
});
