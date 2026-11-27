<?php

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Inertia\Support\Header;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/*
| A different 09XXXXXXXXX number on every call: customer.contact_number is unique,
| and the sample data already uses some numbers (09171234567, 0917111…).
*/
function uniqueMobile(): string
{
    static $next = 0;

    return '0999'.str_pad((string) ++$next, 7, '0', STR_PAD_LEFT);
}

/*
| The customer's project page with every step's details, as the browser ends up
| with it: the first request, then the deferred steps it fetches right after
| (see Customer\ProjectController::show). A 404 or redirect comes back as is.
*/
function customerProjectPage(TestCase $test, Project $project): TestResponse
{
    $url = "/customer/projects/{$project->project_id}";
    $first = $test->get($url);

    if ($first->status() !== 200) {
        return $first;
    }

    $page = json_decode(json_encode($first->viewData('page')), true);
    $deferred = collect($page['deferredProps'] ?? [])->flatten()->all();

    if ($deferred === []) {
        return $first;
    }

    // The second request asks for everything, so the test sees the whole page in one response.
    return $test->get($url, [
        Header::VERSION => (string) $page['version'],
        Header::PARTIAL_COMPONENT => $page['component'],
        Header::PARTIAL_ONLY => implode(',', [...array_keys($page['props']), ...$deferred]),
    ]);
}
