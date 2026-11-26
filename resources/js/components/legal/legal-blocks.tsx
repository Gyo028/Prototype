import { COMPANY } from '@/data/legal';
import { useSiteContact } from '@/lib/public-site';
import type { LegalBlock } from '@/data/legal';

export type LegalSize = 'dialog' | 'page';

// Text sizes for the small popup and for the full page.
const styles = {
    dialog: {
        text: 'text-sm leading-6',
        gap: 'space-y-3',
        sub: 'text-sm',
        label: 'w-9',
        list: 'space-y-1.5',
    },
    page: {
        text: 'text-[15px] leading-7 sm:text-base sm:leading-8',
        gap: 'space-y-5',
        sub: 'text-base',
        label: 'w-11',
        list: 'space-y-2.5',
    },
};

/** Renders **bold** text and turns web addresses into links. */
function Inline({ text }: { text: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <strong key={index} className="font-semibold text-ink">
                            {part.slice(2, -2)}
                        </strong>
                    );
                }

                if (/^https?:\/\//.test(part)) {
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#8B6914] underline underline-offset-4 transition-colors hover:text-[#C99A2E]"
                        >
                            {part}
                        </a>
                    );
                }

                return part;
            })}
        </>
    );
}

/** Renders the paragraphs, numbered clauses, bullet lists and contact box of one section. */
export default function LegalBlocks({ blocks, size }: { blocks: LegalBlock[]; size: LegalSize }) {
    const s = styles[size];
    // The contact block shows the Contact & Footer details from Website Content.
    const contact = useSiteContact();

    return (
        <div className={`${s.gap} ${s.text} text-ink-soft`}>
            {blocks.map((block, index) => {
                switch (block.type) {
                    case 'p':
                        return (
                            <p key={index}>
                                <Inline text={block.text} />
                            </p>
                        );

                    case 'sub':
                        return (
                            <h4 key={index} className={`pt-3 font-semibold text-ink ${s.sub}`}>
                                {block.text}
                            </h4>
                        );

                    case 'clauses':
                        return (
                            <ol key={index} className="space-y-3">
                                {block.items.map((item) => {
                                    const match = item.match(/^(\d+\.\d+)\.?\s+([\s\S]*)$/);
                                    const label = match ? match[1] : '';
                                    const body = match ? match[2] : item;

                                    return (
                                        <li key={item} className="flex gap-3">
                                            <span className={`shrink-0 font-semibold text-[#C99A2E] ${s.label}`}>
                                                {label}
                                            </span>
                                            <span>
                                                <Inline text={body} />
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                        );

                    case 'list':
                        return (
                            <ul key={index} className={s.list}>
                                {block.items.map((item) => (
                                    <li key={item} className="flex gap-3">
                                        <span
                                            aria-hidden="true"
                                            className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#C99A2E]"
                                        />
                                        <span>
                                            <Inline text={item} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        );

                    case 'contact':
                        return (
                            <address
                                key={index}
                                className="border-l-2 border-[#C99A2E] bg-[#FBF9F5] px-5 py-4 not-italic"
                            >
                                <p className="font-semibold text-ink">{contact.name}</p>
                                <p className="mt-2">Business Address: {contact.address}</p>
                                <p>Email Address: {contact.email}</p>
                                <p>Contact Number: {contact.phone}</p>
                                {block.dpo && <p>Data Protection Officer / Privacy Contact: {COMPANY.privacyContact}</p>}
                            </address>
                        );

                    default:
                        return null;
                }
            })}
        </div>
    );
}
