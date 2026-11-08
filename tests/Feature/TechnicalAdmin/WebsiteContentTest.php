<?php

use App\Enums\Role;
use App\Models\User;
use App\Models\WebsiteContent;
use Database\Seeders\WebsiteContentSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->withoutVite();
    $this->seed(WebsiteContentSeeder::class);
    $this->admin = User::factory()->create(['role' => Role::TechnicalAdmin]);
});

function validServices(array $overrides = []): array
{
    return array_merge([
        'title' => 'What We Do',
        'intro' => 'Everything for your event.',
        'cards' => [
            ['title' => 'Corporate', 'description' => 'For companies.'],
            ['title' => 'Occasions', 'description' => 'For celebrations.'],
            ['title' => 'Fabrication', 'description' => 'Custom builds.'],
        ],
    ], $overrides);
}

function validContact(array $overrides = []): array
{
    return array_merge([
        'phone' => '+63 917 123 4567',
        'email' => 'hello@example.com',
        'address' => 'Caloocan City',
        'facebook' => 'https://facebook.com/greata',
        'instagram' => '',
        'copyright' => '© 2026 Great A\'s',
    ], $overrides);
}

function faqTitles(): array
{
    return WebsiteContent::where('section', 'faq')->orderBy('sort_order')->pluck('title')->all();
}

test('only the Technical Admin can open or change the website content', function (Role $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)->get(route('technical-admin.website-content'))->assertForbidden();
    $this->actingAs($user)->put(route('technical-admin.website-content.about'), ['title' => 'x', 'content' => 'y'])->assertForbidden();
    $this->actingAs($user)->post(route('technical-admin.website-content.faqs.store'), ['question' => 'q', 'answer' => 'a'])->assertForbidden();
})->with([Role::Customer, Role::ProjectManager, Role::Owner]);

test('the screen shows the saved content of each section', function () {
    $this->actingAs($this->admin)
        ->get(route('technical-admin.website-content'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('technical-admin/website-content')
            ->where('about.title', 'About Us')
            ->where('services.title', 'Our Services')
            ->has('services.cards', 3)
            ->where('contact.email', 'gr3ataseventsstyling@gmail.com')
            ->has('faqs', 6)
            ->where('faqs.0.id', fn ($id) => is_int($id))
            ->has('updated.about')
            ->has('updated.faq')
        );
});

test('About Us is saved right away and remembers who changed it', function () {
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.about'), ['title' => 'Who We Are', 'content' => "First.\n\nSecond."])
        ->assertRedirect(route('technical-admin.website-content'))
        ->assertSessionHasNoErrors();

    $about = WebsiteContent::where('block_key', 'about')->firstOrFail();

    expect($about->title)->toBe('Who We Are')
        ->and($about->content)->toBe("First.\n\nSecond.")
        ->and($about->updated_by)->toBe($this->admin->id)
        ->and(WebsiteContent::where('block_key', 'about')->count())->toBe(1);
});

test('About Us needs a title and content within the limits', function (array $input, array $errors) {
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.about'), $input)
        ->assertSessionHasErrors($errors);
})->with([
    'empty' => [['title' => '', 'content' => ''], ['title', 'content']],
    'title too long' => [['title' => str_repeat('a', 41), 'content' => 'ok'], ['title']],
    'content too long' => [['title' => 'ok', 'content' => str_repeat('a', 1501)], ['content']],
]);

test('a missing block is created when it is first saved', function () {
    WebsiteContent::query()->delete();

    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.about'), ['title' => 'About Us', 'content' => 'Hello.'])
        ->assertSessionHasNoErrors();

    expect(WebsiteContent::where('block_key', 'about')->value('section'))->toBe('homepage');
});

test('Our Services saves the heading and the three cards', function () {
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.services'), validServices())
        ->assertRedirect(route('technical-admin.website-content'))
        ->assertSessionHasNoErrors();

    $heading = WebsiteContent::where('block_key', 'services')->firstOrFail();
    $cards = WebsiteContent::where('section', 'services')->whereNull('block_key')->orderBy('sort_order')->get();

    expect($heading->title)->toBe('What We Do')
        ->and($heading->content)->toBe('Everything for your event.')
        ->and($cards)->toHaveCount(3)
        ->and($cards->pluck('title')->all())->toBe(['Corporate', 'Occasions', 'Fabrication'])
        ->and($cards->last()->content)->toBe('Custom builds.');
});

test('Our Services rejects incomplete or oversized cards and the wrong number of cards', function () {
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.services'), validServices([
            'cards' => [
                ['title' => 'Corporate', 'description' => 'For companies.'],
                ['title' => '', 'description' => 'No title.'],
                ['title' => 'Fabrication', 'description' => str_repeat('a', 151)],
            ],
        ]))
        ->assertSessionHasErrors(['cards.1.title', 'cards.2.description']);

    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.services'), validServices([
            'cards' => [['title' => 'Only', 'description' => 'One.']],
        ]))
        ->assertSessionHasErrors('cards');

    expect(WebsiteContent::where('block_key', 'services')->value('title'))->toBe('Our Services');
});

test('Contact & Footer is saved, and an empty social link is allowed', function () {
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.contact'), validContact())
        ->assertRedirect(route('technical-admin.website-content'))
        ->assertSessionHasNoErrors();

    $saved = json_decode(WebsiteContent::where('block_key', 'contact')->value('content'), true);

    expect($saved['phone'])->toBe('+63 917 123 4567')
        ->and($saved['facebook'])->toBe('https://facebook.com/greata')
        ->and($saved['instagram'])->toBe('')
        ->and($saved['copyright'])->toContain('©');
});

test('Contact & Footer rejects invalid details', function (array $override, string $error) {
    $this->actingAs($this->admin)
        ->put(route('technical-admin.website-content.contact'), validContact($override))
        ->assertSessionHasErrors($error);
})->with([
    'short phone' => [['phone' => '123'], 'phone'],
    'bad email' => [['email' => 'not-an-email'], 'email'],
    'missing address' => [['address' => ''], 'address'],
    'facebook without https' => [['facebook' => 'facebook.com/greata'], 'facebook'],
    'bad instagram link' => [['instagram' => 'ftp://example.com'], 'instagram'],
    'missing copyright' => [['copyright' => ''], 'copyright'],
]);

test('an FAQ entry is added at the end of the list', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.faqs.store'), ['question' => 'Do you deliver?', 'answer' => 'Yes, within Metro Manila.'])
        ->assertRedirect(route('technical-admin.website-content'));

    $titles = faqTitles();

    expect($titles)->toHaveCount(7)
        ->and(end($titles))->toBe('Do you deliver?');
});

test('an incomplete FAQ entry is not saved', function () {
    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.faqs.store'), ['question' => '', 'answer' => ''])
        ->assertSessionHasErrors(['question', 'answer']);

    $this->actingAs($this->admin)
        ->post(route('technical-admin.website-content.faqs.store'), ['question' => str_repeat('a', 151), 'answer' => 'ok'])
        ->assertSessionHasErrors('question');

    expect(WebsiteContent::where('section', 'faq')->count())->toBe(6);
});

test('an FAQ entry can be edited and deleted', function () {
    $faq = WebsiteContent::where('section', 'faq')->orderBy('sort_order')->first();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.faqs.update', $faq), ['question' => 'New question?', 'answer' => 'New answer.'])
        ->assertSessionHasNoErrors();

    expect($faq->fresh()->title)->toBe('New question?')
        ->and($faq->fresh()->content)->toBe('New answer.')
        ->and($faq->fresh()->updated_by)->toBe($this->admin->id);

    $this->actingAs($this->admin)
        ->delete(route('technical-admin.website-content.faqs.destroy', $faq))
        ->assertRedirect(route('technical-admin.website-content'));

    expect(WebsiteContent::where('section', 'faq')->count())->toBe(5)
        ->and(WebsiteContent::find($faq->content_id))->toBeNull();
});

test('FAQ entries can be moved up and down', function () {
    [$first, $second] = faqTitles();
    $secondRow = WebsiteContent::where('section', 'faq')->where('title', $second)->firstOrFail();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.faqs.move', $secondRow), ['direction' => 'up'])
        ->assertRedirect(route('technical-admin.website-content'));

    expect(array_slice(faqTitles(), 0, 2))->toBe([$second, $first]);

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.faqs.move', $secondRow), ['direction' => 'down'])
        ->assertSessionHasNoErrors();

    expect(array_slice(faqTitles(), 0, 2))->toBe([$first, $second]);
});

test('moving the first entry up, or the last one down, changes nothing', function () {
    $before = faqTitles();
    $first = WebsiteContent::where('section', 'faq')->where('title', $before[0])->firstOrFail();
    $last = WebsiteContent::where('section', 'faq')->where('title', end($before))->firstOrFail();

    $this->actingAs($this->admin)->patch(route('technical-admin.website-content.faqs.move', $first), ['direction' => 'up']);
    $this->actingAs($this->admin)->patch(route('technical-admin.website-content.faqs.move', $last), ['direction' => 'down']);

    expect(faqTitles())->toBe($before);
});

test('an invalid move direction is rejected', function () {
    $faq = WebsiteContent::where('section', 'faq')->first();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.faqs.move', $faq), ['direction' => 'sideways'])
        ->assertSessionHasErrors('direction');
});

test('other website content cannot be changed through the FAQ routes', function () {
    $about = WebsiteContent::where('block_key', 'about')->firstOrFail();

    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.faqs.update', $about), ['question' => 'x', 'answer' => 'y'])
        ->assertNotFound();
    $this->actingAs($this->admin)->delete(route('technical-admin.website-content.faqs.destroy', $about))->assertNotFound();
    $this->actingAs($this->admin)
        ->patch(route('technical-admin.website-content.faqs.move', $about), ['direction' => 'up'])
        ->assertNotFound();

    expect($about->fresh()->title)->toBe('About Us');
});