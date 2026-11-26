/*
 * Legal content shown in two places:
 *  - the popups on the registration page (components/auth/terms-dialog.tsx)
 *  - the full pages at /terms and /privacy (components/public/legal-page.tsx)
 * Edit the wording here and both places update.
 */

// ---------------------------------------------------------------------------
// FILL THESE IN: they appear in the documents and on the page headers.
// ---------------------------------------------------------------------------
export const EFFECTIVE_DATE = `November 14, 2026`;

export const COMPANY = {
    name: `GR3AT A's Event Styling Services`,
    product: `E-VenturePro`,
    address: `Altezza, Deparo, Caloocan City, Philippines`,
    email: `gr3ataseventsstyling@gmail.com`,
    phone: `09175352156`,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type LegalBlock =
    | { type: 'p'; text: string }
    /** A small heading inside a section, e.g. "1.1. Account and Personal Information" */
    | { type: 'sub'; text: string }
    /** Numbered clauses. Each item starts with its number, e.g. "2.1. Customers must..." */
    | { type: 'clauses'; items: string[] }
    | { type: 'list'; items: string[] }
    /** The company contact details. dpo: also show the privacy contact line. */
    | { type: 'contact'; dpo?: boolean };

export type LegalSection = { title: string; blocks: LegalBlock[] };

export type LegalDocument = {
    slug: 'terms' | 'privacy';
    /** Full title, used as the page heading */
    title: string;
    /** Short title, used in popups and the browser tab */
    shortTitle: string;
    intro: string[];
    sections: LegalSection[];
    closing: string;
};

// ---------------------------------------------------------------------------
// TERMS AND CONDITIONS
// (Use **double asterisks** for bold text.)
// ---------------------------------------------------------------------------
export const termsAndConditions: LegalDocument = {
    slug: 'terms',
    title: `Terms and Conditions`,
    shortTitle: `Terms & Conditions`,
    intro: [
        `Welcome to E-VenturePro, the official web-based project management system of GR3AT A's Event Styling Services. By accessing or using this platform, you agree to comply with the following Terms and Conditions. Please read these terms carefully before creating an account or using any of the system's features.`,
    ],
    sections: [
        {
            title: `Acceptance of Terms`,
            blocks: [
                {
                    type: 'p',
                    text: `By registering an account, logging into, or using E-VenturePro, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.`,
                },
                {
                    type: 'p',
                    text: `If you do not agree with any part of these terms, you should refrain from using the platform.`,
                },
                {
                    type: 'p',
                    text: `GR3AT A's Event Styling Services reserves the right to update or modify these terms when necessary. Users will be informed of significant changes through the platform or other appropriate communication channels.`,
                },
            ],
        },
        {
            title: `Account Registration and Security`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `2.1. Customers must provide accurate, complete, and updated information when registering an account.`,
                        `2.2. A valid email address is required for account verification and receiving important system notifications.`,
                        `2.3. Users are responsible for maintaining the confidentiality of their login credentials and for all activities performed through their accounts.`,
                        `2.4. Users must not share their passwords or allow unauthorized individuals to access their accounts.`,
                        `2.5. Users must immediately notify the business if they suspect unauthorized access or suspicious activity involving their accounts.`,
                        `2.6. GR3AT A's reserves the right to restrict, disable, or suspend accounts involved in unauthorized access, misuse, fraudulent activities, or violations of these terms.`,
                    ],
                },
            ],
        },
        {
            title: `Use of the System`,
            blocks: [
                {
                    type: 'p',
                    text: `E-VenturePro provides customers with access to business information and digital tools for managing event styling services.`,
                },
                { type: 'p', text: `The platform includes the following features:` },
                {
                    type: 'list',
                    items: [
                        `Viewing business services, packages, pricing, and portfolio.`,
                        `Submitting project and service requests.`,
                        `Creating preliminary 2D design layouts using the available asset library.`,
                        `Viewing initial material cost estimates.`,
                        `Scheduling consultation appointments and ocular visits.`,
                        `Reviewing and approving design proposals.`,
                        `Requesting design revisions.`,
                        `Viewing project progress and notifications.`,
                        `Uploading payment receipts and tracking payment records.`,
                        `Accessing project quotations, contracts, and other related documents.`,
                        `Submitting ratings and reviews for completed projects.`,
                    ],
                },
                {
                    type: 'p',
                    text: `Users agree to use these features only for their intended purposes and in accordance with applicable laws.`,
                },
            ],
        },
        {
            title: `Service Requests and Project Information`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `4.1. Customers must provide complete and accurate project information, including the event type, theme, budget, venue, event date, design preferences, and other required specifications.`,
                        `4.2. Customers may upload reference images and other supporting materials to help the business understand their requested designs.`,
                        `4.3. Submission of a service request does not automatically guarantee project approval or booking confirmation.`,
                        `4.4. All submitted requests are subject to review and evaluation by the Project Manager.`,
                        `4.5. GR3AT A's reserves the right to approve or reject service requests based on project requirements, scheduling availability, operational capacity, and other relevant considerations.`,
                        `4.6. Customers may be required to attend consultations or ocular visits to further discuss project requirements and assess the event venue.`,
                    ],
                },
            ],
        },
        {
            title: `2D Design Layout Tool and Initial Quotations`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `5.1. The 2D Design Layout Tool allows customers to visualize preliminary event styling arrangements using available design templates and pre-priced assets.`,
                        `5.2. The system automatically generates an initial cost estimate based on the selected services, assets, and customer-provided custom items.`,
                        `5.3. The automatically generated estimate is intended for reference purposes only and represents an initial material cost estimate, not the final project quotation.`,
                        `5.4. The initial estimate may not include additional expenses such as labor, transportation, installation, fabrication, and other project-specific requirements.`,
                        `5.5. The final project quotation will be reviewed, adjusted, and approved by the Project Manager before being presented to the customer.`,
                        `5.6. Customers acknowledge that the final quotation may differ from the initial estimate following consultation, site assessment, and evaluation of actual project requirements.`,
                    ],
                },
            ],
        },
        {
            title: `Design Proposals and Revisions`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `6.1. Design proposals are prepared by the assigned Design Specialist based on the customer's submitted requirements and approved project specifications.`,
                        `6.2. Customers may review submitted design proposals and either approve them or request revisions through the system.`,
                        `6.3. Revision requests must include clear comments or instructions to help the Design Specialist understand the requested changes.`,
                        `6.4. Customers are responsible for carefully reviewing the submitted design proposals before providing their approval.`,
                        `6.5. Once a design proposal is approved, it will serve as the reference for the succeeding project preparation and execution activities, subject to the terms of the project contract.`,
                        `6.6. Any subsequent changes to approved designs must be coordinated with the Project Manager and may require additional costs or adjustments to the project schedule.`,
                    ],
                },
            ],
        },
        {
            title: `Project Contracts and Agreements`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `7.1. Customers are required to review and approve the project contract before the project proceeds to the implementation phase.`,
                        `7.2. The system may provide an electronic signing option or allow customers to upload a physically signed contract in an accepted file format.`,
                        `7.3. The submitted contract is subject to verification and approval by the Project Manager.`,
                        `7.4. Customers must carefully review the project details, scope of work, pricing, payment arrangements, and other provisions stated in the contract before signing.`,
                        `7.5. The approved project contract shall serve as the formal reference for the agreed project requirements and obligations of the parties.`,
                    ],
                },
            ],
        },
        {
            title: `Payments and Billing`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `8.1. Customers may submit payments through the GCash QR Code provided by GR3AT A's and upload the corresponding proof of payment through the system.`,
                        `8.2. Payments made through cash or cheque must be coordinated with the Project Manager for proper recording.`,
                        `8.3. All submitted payment receipts are subject to verification by the authorized personnel.`,
                        `8.4. Uploading proof of payment does not automatically mean that the transaction has been verified or accepted.`,
                        `8.5. Customers may monitor their payment history, outstanding balances, and payment status through the platform.`,
                        `8.6. Additional charges arising from changes in project requirements or other approved project expenses must be properly documented and communicated to the customer.`,
                        `8.7. Customers may submit billing disputes through the system when they have concerns regarding recorded charges or payment transactions.`,
                        `8.8. Payment disputes will be reviewed by the Project Manager, and the resolution will be recorded in the system.`,
                        `8.9. E-VenturePro does not directly process credit or debit card payments.`,
                    ],
                },
            ],
        },
        {
            title: `Project Scheduling, Rescheduling, and Cancellation`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `9.1. Project schedules, fabrication activities, installation arrangements, and assigned personnel are managed by the Project Manager.`,
                        `9.2. The Project Manager may reschedule or cancel a project during execution when necessary, provided that the appropriate reason or remarks are recorded in the system.`,
                        `9.3. Customers will receive notifications regarding project rescheduling or cancellation through the platform or other available communication channels.`,
                        `9.4. Customers who wish to request changes to their project schedule or cancel an existing booking must coordinate directly with GR3AT A's through its official communication channels.`,
                        `9.5. Any applicable cancellation charges, refund arrangements, or financial obligations shall be governed by the approved project contract and the applicable agreement between the customer and GR3AT A's.`,
                        `9.6. Project completion and payment settlement are tracked independently. A project may be marked as completed even when an outstanding balance remains, subject to the approved project arrangements.`,
                    ],
                },
            ],
        },
        {
            title: `Customer Responsibilities`,
            blocks: [
                { type: 'p', text: `Customers agree to:` },
                {
                    type: 'list',
                    items: [
                        `Provide truthful and accurate information.`,
                        `Submit legitimate project requests and supporting documents.`,
                        `Protect their account credentials.`,
                        `Review quotations, design proposals, and contracts carefully.`,
                        `Upload valid payment receipts and supporting documents.`,
                        `Communicate project concerns and revision requests appropriately.`,
                        `Avoid submitting offensive, unlawful, misleading, or unauthorized content.`,
                        `Refrain from attempting to access restricted system functions or other users' information.`,
                        `Use the platform responsibly and respect the rights of GR3AT A's and other users.`,
                    ],
                },
            ],
        },
        {
            title: `Intellectual Property and Uploaded Materials`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `11.1. The system's branding, website content, design templates, asset library, and other original materials belonging to GR3AT A's are protected by applicable intellectual property laws.`,
                        `11.2. Users must not reproduce, distribute, modify, or commercially exploit the platform's protected materials without proper authorization.`,
                        `11.3. Customers retain their rights to the original materials they upload, subject to any applicable third-party rights.`,
                        `11.4. By uploading reference images, design materials, and other project-related files, customers authorize GR3AT A's to use those materials for the purpose of evaluating, preparing, and carrying out the requested project.`,
                        `11.5. Customers must ensure that they have the necessary rights or permission to upload and use any materials they submit.`,
                    ],
                },
            ],
        },
        {
            title: `System Availability and Limitations`,
            blocks: [
                {
                    type: 'clauses',
                    items: [
                        `12.1. E-VenturePro is designed to provide convenient access to project information and business services through supported web browsers and internet-connected devices.`,
                        `12.2. Temporary interruptions may occur due to maintenance, technical issues, internet connectivity problems, or third-party service disruptions.`,
                        `12.3. GR3AT A's will make reasonable efforts to maintain system availability and protect stored information.`,
                        `12.4. The system's 2D Design Layout Tool is intended for preliminary design visualization and does not support highly complex or advanced design customization.`,
                        `12.5. The system does not provide an integrated 3D design creation tool. Three-dimensional visualizations, when available, are prepared using external software.`,
                        `12.6. GR3AT A's shall not be held responsible for service interruptions caused by circumstances beyond its reasonable control.`,
                    ],
                },
            ],
        },
        {
            title: `Privacy and Data Protection`,
            blocks: [
                {
                    type: 'p',
                    text: `GR3AT A's respects the privacy of its users and is committed to protecting personal information collected through E-VenturePro.`,
                },
                {
                    type: 'p',
                    text: `Personal information will be collected, processed, stored, and used only for legitimate business and operational purposes in accordance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).`,
                },
                {
                    type: 'p',
                    text: `For further information, users should refer to the E-VenturePro Privacy Policy.`,
                },
            ],
        },
        {
            title: `Suspension and Termination of Accounts`,
            blocks: [
                {
                    type: 'p',
                    text: `GR3AT A's reserves the right to restrict, suspend, or terminate access to accounts that violate these Terms and Conditions, engage in fraudulent activities, misuse the platform, or compromise system security.`,
                },
                {
                    type: 'p',
                    text: `Users who wish to discontinue using the platform or request account-related actions may contact the business through its official communication channels.`,
                },
                {
                    type: 'p',
                    text: `Any outstanding contractual or financial obligations shall remain subject to the applicable project agreement and relevant laws.`,
                },
            ],
        },
        {
            title: `Amendments to Terms`,
            blocks: [
                {
                    type: 'p',
                    text: `GR3AT A's reserves the right to revise these Terms and Conditions when necessary to reflect changes in business operations, system functionality, or applicable legal requirements.`,
                },
                {
                    type: 'p',
                    text: `Updated terms will be made available through E-VenturePro. Continued use of the platform after the effective date of the changes constitutes acknowledgment of the updated terms, subject to applicable law.`,
                },
            ],
        },
        {
            title: `Governing Law`,
            blocks: [
                {
                    type: 'p',
                    text: `These Terms and Conditions shall be governed by and interpreted in accordance with the laws of the Republic of the Philippines.`,
                },
                {
                    type: 'p',
                    text: `Any disputes arising from the use of E-VenturePro or the services provided by GR3AT A's shall be addressed through appropriate communication and resolution procedures, without prejudice to the rights and remedies available under applicable Philippine laws.`,
                },
            ],
        },
        {
            title: `Contact Information`,
            blocks: [
                {
                    type: 'p',
                    text: `For questions, concerns, or clarifications regarding these Terms and Conditions, users may contact:`,
                },
                { type: 'contact' },
            ],
        },
    ],
    closing: `By using E-VenturePro, you acknowledge that you have read and agreed to these Terms and Conditions.`,
};

// ---------------------------------------------------------------------------
// PRIVACY POLICY
// ---------------------------------------------------------------------------
export const privacyPolicy: LegalDocument = {
    slug: 'privacy',
    title: `Privacy Policy`,
    shortTitle: `Privacy Policy`,
    intro: [
        `GR3AT A's Event Styling Services values the privacy and security of its customers, employees, and other authorized users. This Privacy Policy explains how E-VenturePro collects, uses, stores, processes, and protects personal information when users access and interact with the platform.`,
        `This policy is established in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and other applicable Philippine data protection requirements.`,
        `By using E-VenturePro, you acknowledge that you have been informed of the data processing practices described in this Privacy Policy.`,
    ],
    sections: [
        {
            title: `Personal Information We Collect`,
            blocks: [
                {
                    type: 'p',
                    text: `E-VenturePro collects information necessary for account management, project coordination, payment monitoring, and the delivery of event styling services.`,
                },
                { type: 'p', text: `The information collected may include the following:` },
                { type: 'sub', text: `1.1. Account and Personal Information` },
                {
                    type: 'list',
                    items: [
                        `Full name`,
                        `Email address`,
                        `Contact number`,
                        `Login credentials and authentication-related information`,
                        `Assigned user role and account status`,
                    ],
                },
                { type: 'sub', text: `1.2. Project and Service Information` },
                {
                    type: 'list',
                    items: [
                        `Event type and occasion`,
                        `Event date and preferred schedule`,
                        `Venue and location details`,
                        `Event theme and design preferences`,
                        `Project specifications and requirements`,
                        `Customer-provided budget`,
                        `Reference images and other uploaded project materials`,
                    ],
                },
                { type: 'sub', text: `1.3. Payment and Financial Information` },
                {
                    type: 'list',
                    items: [
                        `Payment amount`,
                        `Payment method`,
                        `Payment date`,
                        `Uploaded payment receipts or proof of payment`,
                        `Transaction and verification status`,
                        `Outstanding balances`,
                        `Billing disputes and supporting documents`,
                    ],
                },
                { type: 'sub', text: `1.4. Project Documents and Files` },
                {
                    type: 'p',
                    text: `Depending on the services requested, E-VenturePro may collect and store:`,
                },
                {
                    type: 'list',
                    items: [
                        `Signed project contracts`,
                        `Project quotations`,
                        `Design proposals`,
                        `2D layout outputs`,
                        `3D design visualization files, when provided`,
                        `Site assessment reports`,
                        `Supporting venue photographs`,
                        `Other project-related documents`,
                    ],
                },
                { type: 'sub', text: `1.5. Feedback and Communication Information` },
                {
                    type: 'list',
                    items: [
                        `Customer ratings`,
                        `Written reviews and comments`,
                        `Revision requests`,
                        `Billing concerns and disputes`,
                        `Appointment details`,
                        `System notifications and communication records`,
                    ],
                },
            ],
        },
        {
            title: `How We Collect Information`,
            blocks: [
                {
                    type: 'p',
                    text: `Personal information may be collected through the following activities:`,
                },
                {
                    type: 'clauses',
                    items: [
                        `2.1. **Account Registration:** When customers create accounts and submit their registration details.`,
                        `2.2. **System Usage:** When users log in, access their dashboards, and interact with the available system features.`,
                        `2.3. **Service Requests:** When customers submit project requirements, event details, design preferences, and reference materials.`,
                        `2.4. **Appointments:** When customers schedule consultations or ocular visits.`,
                        `2.5. **Design Activities:** When customers create preliminary 2D layouts, submit design requirements, or review design proposals.`,
                        `2.6. **Payment Transactions:** When customers upload payment receipts or submit billing concerns.`,
                        `2.7. **Project Management:** When authorized personnel record project schedules, assignments, updates, expenses, and other operational information.`,
                        `2.8. **Feedback Submission:** When customers provide ratings and reviews regarding completed projects.`,
                    ],
                },
            ],
        },
        {
            title: `Purpose of Data Collection and Processing`,
            blocks: [
                {
                    type: 'p',
                    text: `E-VenturePro processes personal information for the following purposes:`,
                },
                { type: 'sub', text: `3.1. Account Management and Authentication` },
                {
                    type: 'list',
                    items: [
                        `Creating and maintaining user accounts.`,
                        `Verifying registered email addresses.`,
                        `Authenticating user identities.`,
                        `Managing user roles and access permissions.`,
                        `Protecting accounts against unauthorized access.`,
                    ],
                },
                { type: 'sub', text: `3.2. Service Request and Project Management` },
                {
                    type: 'list',
                    items: [
                        `Receiving and evaluating customer requests.`,
                        `Coordinating consultations and ocular visits.`,
                        `Managing project requirements and specifications.`,
                        `Preparing and reviewing design proposals.`,
                        `Managing project schedules, assignments, and progress.`,
                        `Recording project status updates.`,
                    ],
                },
                { type: 'sub', text: `3.3. Design and Quotation Management` },
                {
                    type: 'list',
                    items: [
                        `Processing customer design preferences.`,
                        `Generating preliminary 2D design layouts.`,
                        `Calculating initial material cost estimates.`,
                        `Preparing and reviewing final project quotations.`,
                        `Managing design revisions and approvals.`,
                    ],
                },
                { type: 'sub', text: `3.4. Payment and Financial Management` },
                {
                    type: 'list',
                    items: [
                        `Recording customer payment submissions.`,
                        `Verifying uploaded proof of payment.`,
                        `Monitoring outstanding balances.`,
                        `Recording cash and cheque transactions.`,
                        `Managing billing disputes and additional charges.`,
                        `Generating financial records and reports.`,
                    ],
                },
                { type: 'sub', text: `3.5. Notifications and Communication` },
                {
                    type: 'list',
                    items: [
                        `Sending email verification messages.`,
                        `Providing appointment confirmations.`,
                        `Sending project updates and status notifications.`,
                        `Informing users about design approvals and revision requests.`,
                        `Sending payment confirmations and verification results.`,
                        `Notifying assigned personnel about project schedules and responsibilities.`,
                    ],
                },
                { type: 'sub', text: `3.6. Business Operations and Service Improvement` },
                {
                    type: 'list',
                    items: [
                        `Monitoring ongoing and completed projects.`,
                        `Evaluating customer feedback.`,
                        `Reviewing business performance.`,
                        `Improving service delivery and operational processes.`,
                    ],
                },
                {
                    type: 'p',
                    text: `Personal information will not be processed for purposes unrelated to those disclosed in this policy unless another lawful basis permits such processing.`,
                },
            ],
        },
        {
            title: `Legal Basis for Processing`,
            blocks: [
                {
                    type: 'p',
                    text: `GR3AT A's processes personal information based on applicable lawful grounds under the Data Privacy Act of 2012.`,
                },
                { type: 'p', text: `These may include:` },
                {
                    type: 'list',
                    items: [
                        `**Consent:** When users voluntarily provide permission for specific data processing activities, where consent is the appropriate legal basis.`,
                        `**Contractual Necessity:** When processing is necessary to fulfill a requested service, manage a project, or take steps requested by the customer before entering into a contract.`,
                        `**Legal Obligation:** When information must be processed or retained to comply with applicable laws and regulations.`,
                        `**Legitimate Interests:** When processing is necessary for legitimate business and operational purposes, provided that these interests do not override the fundamental rights and freedoms of the data subject.`,
                    ],
                },
            ],
        },
        {
            title: `Data Storage and Security`,
            blocks: [
                {
                    type: 'p',
                    text: `E-VenturePro uses a centralized database and file storage infrastructure to manage system records and uploaded documents.`,
                },
                {
                    type: 'p',
                    text: `The system is designed to implement security measures such as:`,
                },
                {
                    type: 'list',
                    items: [
                        `Password hashing to protect stored passwords.`,
                        `Secure session management.`,
                        `HTTPS connections for secure communication.`,
                        `Role-Based Access Control (RBAC) to limit access according to assigned responsibilities.`,
                        `Private file storage for uploaded receipts, contracts, design proposals, and other project documents.`,
                        `Scheduled database backups to support data recovery.`,
                    ],
                },
                {
                    type: 'p',
                    text: `Access to personal information is limited to authorized personnel whose responsibilities require access to the relevant records.`,
                },
                {
                    type: 'p',
                    text: `GR3AT A's takes reasonable measures to protect personal information against unauthorized access, alteration, disclosure, loss, and destruction. However, no electronic system or internet-based transmission can be guaranteed to be completely secure.`,
                },
            ],
        },
        {
            title: `Sharing and Disclosure of Information`,
            blocks: [
                {
                    type: 'p',
                    text: `GR3AT A's does not intend to sell or disclose personal information for unrelated commercial purposes.`,
                },
                {
                    type: 'p',
                    text: `Information may be shared with the following authorized recipients when necessary:`,
                },
                { type: 'sub', text: `6.1. Internal Personnel` },
                {
                    type: 'p',
                    text: `Depending on their assigned responsibilities, the following personnel may access relevant customer and project information:`,
                },
                {
                    type: 'list',
                    items: [
                        `Owner`,
                        `Project Manager`,
                        `Design Specialist`,
                        `Bookkeeper`,
                        `Technical Administrator`,
                        `Assigned fabrication and installation personnel`,
                    ],
                },
                {
                    type: 'p',
                    text: `Access is limited according to their respective system roles and operational requirements.`,
                },
                { type: 'sub', text: `6.2. Technology and Service Providers` },
                {
                    type: 'p',
                    text: `E-VenturePro may rely on third-party service providers to support its operations, including:`,
                },
                {
                    type: 'list',
                    items: [
                        `**Supabase:** For database management and file storage.`,
                        `**Gmail SMTP:** For sending automated email notifications.`,
                        `**Google:** For supported Google account authentication services.`,
                    ],
                },
                {
                    type: 'p',
                    text: `These providers may process or access information as necessary to deliver their respective services, subject to applicable agreements and safeguards.`,
                },
                { type: 'sub', text: `6.3. Legal and Regulatory Authorities` },
                {
                    type: 'p',
                    text: `Information may be disclosed when required by applicable laws, regulations, court orders, or lawful government requests.`,
                },
                { type: 'sub', text: `6.4. Project-Related Personnel` },
                {
                    type: 'p',
                    text: `Relevant project details may be shared with assigned fabrication and installation personnel when necessary to perform their responsibilities, such as receiving project work orders and installation schedules.`,
                },
                {
                    type: 'p',
                    text: `Only information necessary for the intended purpose should be disclosed.`,
                },
            ],
        },
        {
            title: `Data Retention and Disposal`,
            blocks: [
                {
                    type: 'p',
                    text: `Personal information will only be retained for as long as necessary to fulfill the purposes for which it was collected, comply with legal obligations, or establish, exercise, or defend legal claims.`,
                },
                {
                    type: 'p',
                    text: `Project records, payment information, signed contracts, and other business documents may be retained when required for legitimate operational, accounting, or legal purposes.`,
                },
                {
                    type: 'p',
                    text: `When personal information is no longer necessary, it will be securely deleted, destroyed, or anonymized, subject to applicable legal retention requirements.`,
                },
            ],
        },
        {
            title: `Rights of Data Subjects`,
            blocks: [
                {
                    type: 'p',
                    text: `In accordance with the Data Privacy Act of 2012, users have the following rights regarding their personal information:`,
                },
                { type: 'sub', text: `8.1. Right to Be Informed` },
                {
                    type: 'p',
                    text: `Users have the right to know whether their personal information is being collected, stored, or processed and the purposes for which it is used.`,
                },
                { type: 'sub', text: `8.2. Right to Access` },
                {
                    type: 'p',
                    text: `Users may request reasonable access to their personal information and relevant details regarding its processing.`,
                },
                { type: 'sub', text: `8.3. Right to Rectification` },
                {
                    type: 'p',
                    text: `Users may request corrections to inaccurate or incomplete personal information.`,
                },
                { type: 'sub', text: `8.4. Right to Object` },
                {
                    type: 'p',
                    text: `Users may object to the processing of their personal information when permitted under applicable law.`,
                },
                { type: 'sub', text: `8.5. Right to Erasure or Blocking` },
                {
                    type: 'p',
                    text: `Users may request the removal, blocking, or destruction of their personal information when the conditions under the Data Privacy Act are satisfied.`,
                },
                { type: 'sub', text: `8.6. Right to Data Portability` },
                {
                    type: 'p',
                    text: `Users may request a copy of their personal information in a structured and commonly used electronic format, where applicable.`,
                },
                { type: 'sub', text: `8.7. Right to Damages` },
                {
                    type: 'p',
                    text: `Users may seek compensation for damages sustained due to inaccurate, incomplete, outdated, false, unlawfully obtained, or unauthorized use of their personal information, subject to applicable law.`,
                },
                { type: 'sub', text: `8.8. Right to File a Complaint` },
                {
                    type: 'p',
                    text: `Users may file a complaint with the National Privacy Commission if they believe their data privacy rights have been violated.`,
                },
                {
                    type: 'p',
                    text: `The exercise of these rights is subject to applicable legal requirements, including lawful grounds for continued processing or retention.`,
                },
            ],
        },
        {
            title: `Data Breach and Security Incidents`,
            blocks: [
                {
                    type: 'p',
                    text: `In the event of a personal data breach or security incident, GR3AT A's will take appropriate steps to investigate, contain, and address the incident.`,
                },
                {
                    type: 'p',
                    text: `Where notification is required under applicable laws and regulations, affected data subjects and the National Privacy Commission will be notified within the prescribed period.`,
                },
                {
                    type: 'p',
                    text: `Reasonable measures will also be taken to prevent similar incidents from occurring.`,
                },
            ],
        },
        {
            title: `Cookies and Session Management`,
            blocks: [
                {
                    type: 'p',
                    text: `E-VenturePro may use session-related technologies necessary for authentication, maintaining user sessions, and supporting essential system functionality.`,
                },
                {
                    type: 'p',
                    text: `These technologies help ensure that users can securely access the appropriate system features and dashboards.`,
                },
                {
                    type: 'p',
                    text: `Any additional analytics or non-essential tracking technologies, if implemented, should be disclosed separately and handled in accordance with applicable privacy requirements.`,
                },
            ],
        },
        {
            title: `External Links and Third-Party Services`,
            blocks: [
                {
                    type: 'p',
                    text: `E-VenturePro may contain links or integrations involving third-party platforms and services.`,
                },
                {
                    type: 'p',
                    text: `These external services operate under their own privacy policies and terms of use. GR3AT A's does not control the privacy practices of external websites or platforms.`,
                },
                {
                    type: 'p',
                    text: `Users are encouraged to review the applicable privacy policies of third-party services before providing information through them.`,
                },
            ],
        },
        {
            title: `Changes to This Privacy Policy`,
            blocks: [
                {
                    type: 'p',
                    text: `GR3AT A's reserves the right to update this Privacy Policy to reflect changes in system functionality, business operations, security practices, or applicable legal requirements.`,
                },
                {
                    type: 'p',
                    text: `Significant changes will be communicated through the platform or other appropriate channels.`,
                },
                {
                    type: 'p',
                    text: `The updated Privacy Policy will indicate its effective date.`,
                },
            ],
        },
        {
    title: `Contact Information and Privacy Concerns`,
    blocks: [
        {
            type: 'p',
            text: `For questions, requests, or concerns regarding the collection and processing of personal information, users may contact:`,
        },
        { type: 'contact' },
            ],
        },
    ],
    closing: `By using E-VenturePro, users acknowledge that they have been informed about the collection and processing of their personal information as described in this Privacy Policy.`,
};