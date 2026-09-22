/*
 * The questions and answers shown on the public FAQ page.
 * The public page and the Technical Admin FAQ editor both read this list,
 * so they always show the same entries. It moves to the database later
 * (website_contents rows with section = 'faq').
 */

export type Faq = { id: number; question: string; answer: string };

export const faqs: Faq[] = [
    {
        id: 1,
        question: "What services does GR3AT A's Event Styling Services offer?",
        answer: "GR3AT A's Event Styling Services offers event styling, fabrication services, customized event materials, backdrop designs, mall activations, corporate event setups, weddings, birthdays, and other special event services.",
    },
    {
        id: 2,
        question: 'Can I request customized event designs?',
        answer: 'Yes. Customers may submit project requirements and reference peg images for customized event styling and fabricated materials. Design Specialists will create the proposed mock-up designs based on the submitted details.',
    },
    {
        id: 3,
        question: 'Do you provide 3D designs?',
        answer: 'Yes, 3D design outputs may be provided by the Design Specialists; however, these are created using external design platforms and uploaded to the system in PDF format for viewing and approval.',
    },
    {
        id: 4,
        question: 'How do I start a project?',
        answer: 'You can start by creating an account, logging into the system, and clicking the "Start Project" button. Fill out the project details form, upload peg or reference images, select your preferred schedule, and submit your request.',
    },
    {
        id: 5,
        question: 'What information do I need to provide when submitting a project request?',
        answer: 'Customers are required to provide event details such as event type, theme, venue, event date, budget range, project description, and reference images to help the Design Specialists understand the project requirements.',
    },
    {
        id: 6,
        question: 'How will I know if my design proposal is ready?',
        answer: 'The system will notify you through the notification panel and email updates once a Design Specialist uploads or updates your project design proposal.',
    },
];
