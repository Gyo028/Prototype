import { faqs } from '@/data/faqs';
import PublicLayout from '@/layouts/public-layout';

export default function Faq() {
    return (
        <PublicLayout title="FAQs">
            <section id="faq" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="section-title">
                        <h2 className="section-heading">Frequently Asked Questions</h2>
                        <span className="section-line" />
                    </div>

                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                        {faqs.map((faq) => (
                            <details key={faq.id} className="faq-card group">
                                <summary className="faq-header">
                                    <span className="faq-question">{faq.question}</span>

                                    <span className="faq-icon">
                                        <svg
                                            className="faq-arrow"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </span>
                                </summary>

                                <div className="faq-answer">{faq.answer}</div>
                            </details>
                        ))}
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
