<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Models\WebsiteContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Technical Admin > Website Content > FAQ.
 */
class FaqController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_FAQ,
            'title' => $data['question'],
            'content' => $data['answer'],
            'sort_order' => (int) WebsiteContent::where('section', WebsiteContent::SECTION_FAQ)->max('sort_order') + 1,
            'updated_by' => $request->user()->id,
        ]);

        return to_route('technical-admin.website-content');
    }

    public function update(Request $request, WebsiteContent $faq): RedirectResponse
    {
        $this->ensureFaq($faq);

        $data = $this->validated($request);

        $faq->update([
            'title' => $data['question'],
            'content' => $data['answer'],
            'updated_by' => $request->user()->id,
        ]);

        return to_route('technical-admin.website-content');
    }

    public function destroy(WebsiteContent $faq): RedirectResponse
    {
        $this->ensureFaq($faq);

        $faq->delete();

        return to_route('technical-admin.website-content');
    }

    /** Moves an entry one place up or down by swapping it with its neighbour. */
    public function move(Request $request, WebsiteContent $faq): RedirectResponse
    {
        $this->ensureFaq($faq);

        $direction = $request->validate(['direction' => ['required', 'in:up,down']])['direction'];

        DB::transaction(function () use ($faq, $direction, $request) {
            $ids = WebsiteContent::query()
                ->where('section', WebsiteContent::SECTION_FAQ)
                ->orderBy('sort_order')
                ->orderBy('content_id')
                ->pluck('content_id')
                ->all();

            $from = array_search($faq->content_id, $ids, true);
            $to = $direction === 'up' ? $from - 1 : $from + 1;

            if (isset($ids[$to])) {
                [$ids[$from], $ids[$to]] = [$ids[$to], $ids[$from]];
            }

            // Number the list 1..n again, touching only the rows whose place changed.
            foreach ($ids as $position => $id) {
                WebsiteContent::where('content_id', $id)
                    ->where('sort_order', '!=', $position + 1)
                    ->update(['sort_order' => $position + 1, 'updated_by' => $request->user()->id]);
            }
        });

        return to_route('technical-admin.website-content');
    }

    /** @return array{question: string, answer: string} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'question' => ['required', 'string', 'max:150'],
            'answer' => ['required', 'string'],
        ], [
            'question.required' => 'Question is required.',
            'answer.required' => 'Answer is required.',
        ]);
    }

    /** Other website content (About Us, the hero, ...) is not an FAQ entry. */
    private function ensureFaq(WebsiteContent $faq): void
    {
        abort_unless($faq->section === WebsiteContent::SECTION_FAQ, 404);
    }
}