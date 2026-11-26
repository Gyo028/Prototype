<?php

namespace Database\Seeders;

use App\Models\WebsiteContent;
use App\Support\WebsiteDefaults;
use Illuminate\Database\Seeder;

/**
 *   php artisan db:seed --class=WebsiteContentSeeder
 */
class WebsiteContentSeeder extends Seeder
{
    public function run(): void
    {
        if (WebsiteContent::query()->exists()) {
            return;
        }

        $this->homepage();
        $this->services();
        $this->faq();

        // Photo slots, the service pages and the Our Works photo library.
        WebsiteDefaults::applyPhotos();
    }

    /**
     * Hero, About Us and Contact & Footer: three rows, told apart by block_key.
     * The hero text is fixed in the page, so the hero row only holds its photo.
     */
    private function homepage(): void
    {
        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_HOMEPAGE,
            'block_key' => 'hero',
            'title' => 'Hero Section',
            'content' => null,
            'sort_order' => 1,
        ]);

        // Two paragraphs, separated by a blank line.
        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_HOMEPAGE,
            'block_key' => 'about',
            'title' => 'About Us',
            'content' => implode("\n\n", WebsiteDefaults::ABOUT),
            'sort_order' => 2,
        ]);

        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_HOMEPAGE,
            'block_key' => 'contact',
            'title' => 'Contact & Footer',
            'content' => $this->json(array_diff_key(WebsiteDefaults::CONTACT, ['name' => true])),
            'sort_order' => 3,
        ]);
    }

    /** The section heading plus one row per service card (titles are fixed). */
    private function services(): void
    {
        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_SERVICES,
            'block_key' => 'services',
            'title' => 'Our Services',
            'content' => null,
            'sort_order' => 0,
        ]);

        $descriptions = [
            'Professional styling and management for brand activations, mall events, and corporate functions.',
            'Creative setups for weddings, birthdays, debuts, and milestone celebrations.',
            'Design and production of customized backdrops, props, and themed event structures.',
        ];

        foreach (WebsiteDefaults::CARD_TITLES as $i => $title) {
            $description = $descriptions[$i];

            WebsiteContent::create([
                'section' => WebsiteContent::SECTION_SERVICES,
                'title' => $title,
                'content' => $description,
                'sort_order' => $i + 1,
            ]);
        }
    }

    /** One row per question: title is the question, content is the answer. */
    private function faq(): void
    {
        $faqs = [
            ["What services does GR3AT A's Event Styling Services offer?", "GR3AT A's Event Styling Services offers event styling, fabrication services, customized event materials, backdrop designs, mall activations, corporate event setups, weddings, birthdays, and other special event services."],
            ['Can I request customized event designs?', 'Yes. Customers may submit project requirements and reference peg images for customized event styling and fabricated materials. Design Specialists will create the proposed mock-up designs based on the submitted details.'],
            ['Do you provide 3D designs?', 'Yes, 3D design outputs may be provided by the Design Specialists; however, these are created using external design platforms and uploaded to the system in PDF format for viewing and approval.'],
            ['How do I start a project?', 'You can start by creating an account, logging into the system, and clicking the "Start Project" button. Fill out the project details form, upload peg or reference images, select your preferred schedule, and submit your request.'],
            ['What information do I need to provide when submitting a project request?', 'Customers are required to provide event details such as event type, theme, venue, event date, budget range, project description, and reference images to help the Design Specialists understand the project requirements.'],
            ['How will I know if my design proposal is ready?', 'The system will notify you through the notification panel and email updates once a Design Specialist uploads or updates your project design proposal.'],
        ];

        foreach ($faqs as $i => [$question, $answer]) {
            WebsiteContent::create([
                'section' => WebsiteContent::SECTION_FAQ,
                'title' => $question,
                'content' => $answer,
                'sort_order' => $i + 1,
            ]);
        }
    }

    /** @param array<string, string> $fields */
    private function json(array $fields): string
    {
        return json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}