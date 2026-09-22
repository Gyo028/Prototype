export default function Footer() {
    return (
        <footer className="border-t border-gray-200 bg-white">
            <div className="mx-auto max-w-[1400px] px-10 py-8">
                <div className="flex flex-wrap items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                        <img src="/images/icons/phone.svg" className="footer-icon" alt="" />
                        <span className="footer-text">+63 0000000000</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <img src="/images/icons/email.svg" className="footer-icon" alt="" />
                        <a href="#" className="footer-text transition hover:text-gold">
                            gr3ataseventsstyling@gmail.com
                        </a>
                    </div>

                    <div className="flex items-center gap-4">
                        <img src="/images/icons/location.svg" className="footer-icon" alt="" />
                        <span className="footer-text">Altezza, Deparo, Caloocan City</span>
                    </div>

                    <div className="flex gap-5">
                        <a
                            href="https://www.facebook.com/share/17uj5e738o/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cursor-pointer"
                        >
                            <img src="/images/icons/facebook.svg" className="footer-social" alt="Facebook" />
                        </a>
                        <a href="#" className="cursor-pointer">
                            <img src="/images/icons/instagram.svg" className="footer-social" alt="Instagram" />
                        </a>
                    </div>
                </div>

                <div className="footer-divider" />

                <p className="footer-copy">© 2026 Great A's Event Styling Services. All rights reserved.</p>
            </div>
        </footer>
    );
}
