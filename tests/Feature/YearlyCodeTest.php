<?php

use App\Models\Contract;
use App\Models\Project;
use App\Models\ServiceRequest;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Carbon;

/*
 * Reference codes: the year created + a number that starts again every year.
 * Requests "REQ-26-0001", projects "PRJ-26-0001", contracts "CON-26-0001"
 * (the contract uses its project's number).
 */

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
});

afterEach(function () {
    Carbon::setTestNow();
});

/** A copy of a saved request, created "now". */
function ycNewRequest(): ServiceRequest
{
    $copy = ServiceRequest::query()->firstOrFail()->replicate(['request_code']);
    $copy->save();

    return $copy;
}

test('every request and project gets a unique code with its year', function () {
    $requests = ServiceRequest::query()->pluck('request_code');
    $projects = Project::query()->pluck('project_code');

    expect($requests->every(fn ($c) => preg_match('/^REQ-\d{2}-\d{4}$/', (string) $c) === 1))->toBeTrue()
        ->and($requests->unique())->toHaveCount($requests->count())
        ->and($projects->every(fn ($c) => preg_match('/^PRJ-\d{2}-\d{4}$/', (string) $c) === 1))->toBeTrue()
        ->and($projects->unique())->toHaveCount($projects->count());
});

test('the number counts up within a year and starts again at 0001 the next year', function () {
    Carbon::setTestNow(Carbon::parse('2030-03-01 10:00', 'Asia/Manila'));
    $first = ycNewRequest();
    $second = ycNewRequest();

    Carbon::setTestNow(Carbon::parse('2031-01-05 10:00', 'Asia/Manila'));
    $nextYear = ycNewRequest();

    expect($first->request_code)->toBe('REQ-30-0001')
        ->and($second->request_code)->toBe('REQ-30-0002')
        ->and($nextYear->request_code)->toBe('REQ-31-0001')
        ->and($first->fresh()->request_code)->toBe('REQ-30-0001'); // saved, not only on the object
});

test('the year is Manila time: just after midnight on January 1 is already the new year', function () {
    Carbon::setTestNow(Carbon::parse('2032-01-01 00:30', 'Asia/Manila')); // still Dec 31 in UTC

    expect(ycNewRequest()->request_code)->toBe('REQ-32-0001');
});

test('a contract uses its project\'s number', function () {
    $project = Project::query()->firstOrFail();

    expect(Contract::codeFor($project))->toBe('CON-'.substr($project->project_code, 4))
        ->and(Contract::codeFor($project))->toMatch('/^CON-\d{2}-\d{4}$/');
});
