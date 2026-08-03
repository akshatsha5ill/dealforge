export default function TermsOfService() {
  const styles = {
    container: { padding: '48px 24px', maxWidth: '800px', margin: '0 auto', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' },
    title: { fontSize: '32px', marginBottom: '8px', color: 'var(--accent-primary)' },
    updated: { color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' },
    h2: { marginTop: '36px', fontSize: '22px', color: 'var(--text-primary)', borderTop: '1px solid var(--border)', paddingTop: '24px' },
    h3: { marginTop: '20px', fontSize: '16px', color: 'var(--accent-primary)' },
    p: { color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7, marginTop: '10px' },
    li: { color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.7, marginTop: '6px' },
    strong: { color: 'var(--text-primary)' },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Terms of Service</h1>
      <p style={styles.updated}>Last updated: {new Date().toLocaleDateString()}</p>

      <h2 style={styles.h2}>1. Acceptance of Terms</h2>
      <p style={styles.p}>
        By installing, accessing, or using DealForge (the "Service"), including our Zoom Marketplace app and web
        application, you agree to these Terms of Service (the "Terms"). If you are using the Service on behalf of a
        company or organization, you represent that you have authority to bind it to these Terms. If you do not
        agree to these Terms, do not use the Service.
      </p>

      <h2 style={styles.h2}>2. Eligibility</h2>
      <p style={styles.p}>
        You must be at least 18 years old (or the age of majority in your jurisdiction) and capable of forming a
        binding contract to use the Service.
      </p>

      <h2 style={styles.h2}>3. Your Account</h2>
      <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
        <li style={styles.li}>You are responsible for safeguarding your login credentials and for all activity under your account.</li>
        <li style={styles.li}>You must provide accurate account information and keep it current.</li>
        <li style={styles.li}>Notify us immediately at <strong style={styles.strong}>support@dealforge.com</strong> if you believe your account has been compromised.</li>
        <li style={styles.li}>You may create only accounts for yourself (or your organization, if authorized). Automated account creation or bulk signups require our prior written consent.</li>
      </ul>

      <h2 style={styles.h2}>4. Recording &amp; Transcription Consent</h2>
      <p style={styles.p}>
        DealForge can capture live transcripts of Zoom meetings and analyze pasted transcripts. You are solely
        responsible for complying with all applicable laws and regulations regarding recording, transcribing, and
        storing communications, including notifying all meeting participants that a meeting is being transcribed
        and obtaining any required consent. DealForge is not liable for any violation of law or of Zoom's policies
        by a user. We recommend enabling participant notifications wherever the platform allows it.
      </p>

      <h2 style={styles.h2}>5. License &amp; Acceptable Use</h2>
      <p style={styles.p}>
        We grant you a limited, non-exclusive, non-transferable, revocable license to use the Service for your
        internal business purposes, subject to these Terms. You agree not to:
      </p>
      <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
        <li style={styles.li}>Resell, sublicense, or provide the Service to third parties as a hosted or managed service;</li>
        <li style={styles.li}>Reverse engineer, decompile, or attempt to extract the source code of the Service;</li>
        <li style={styles.li}>Interfere with or disrupt the Service, servers, or networks connected to the Service;</li>
        <li style={styles.li}>Circumvent rate limits, free-tier quotas, or other usage restrictions, or use automated means to access the Service at scale;</li>
        <li style={styles.li}>Use the Service to transcribe or analyze meetings without required consent, or to process content you do not have the right to process;</li>
        <li style={styles.li}>Upload or process malicious content, viruses, or unlawful material;</li>
        <li style={styles.li}>Use the Service to infringe the intellectual property or privacy rights of others.</li>
      </ul>

      <h2 style={styles.h2}>6. Bring Your Own Key (BYOK)</h2>
      <p style={styles.p}>
        You may provide your own API keys for AI providers (OpenAI, Anthropic, Gemini) or for Resend email.
        Keys are encrypted on your device and are not visible to us. You are responsible for any costs, usage
        limits, and terms of the third-party provider associated with your keys, and for keeping them secret.
        We are not responsible for the availability, behavior, or terms of any third-party AI provider.
      </p>

      <h2 style={styles.h2}>7. AI-Generated Content</h2>
      <p style={styles.p}>
        DealForge uses AI models to generate summaries, action items, lead scores, and email drafts. AI output can
        be inaccurate, incomplete, or unsuitable for a particular purpose. <strong style={styles.strong}>You are
        responsible for reviewing and validating all AI-generated content before relying on or sending it.</strong>
        We make no guarantee regarding the accuracy, reliability, or completeness of AI output, and we are not
        liable for decisions or communications made based on it.
      </p>

      <h2 style={styles.h2}>8. Subscriptions &amp; Billing</h2>
      <p style={styles.p}>
        The Service is offered on a free tier and paid subscription tiers (currently Pro at $29/month and
        Enterprise at $79/month, subject to change). The following terms apply to paid subscriptions:
      </p>
      <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
        <li style={styles.li}><strong style={styles.strong}>Billing cycle:</strong> subscriptions are billed in advance, monthly, via Dodo Payments.</li>
        <li style={styles.li}><strong style={styles.strong}>Free tier limits:</strong> the free tier includes a limited number of analyzed meetings per month (currently 3) and limited transcript history (currently 30 days). We may adjust free-tier limits from time to time with reasonable notice.</li>
        <li style={styles.li}><strong style={styles.strong}>Cancellation:</strong> you may cancel at any time from the Billing page or by contacting support. Cancellation takes effect at the end of the current billing period; access continues until then.</li>
        <li style={styles.li}><strong style={styles.strong}>Refunds:</strong> fees already paid for the current billing period are non-refundable, except where required by law or as otherwise stated at purchase.</li>
        <li style={styles.li}><strong style={styles.strong}>Taxes:</strong> you are responsible for any applicable taxes.</li>
        <li style={styles.li}><strong style={styles.strong}>Price changes:</strong> we may change prices for future billing periods with at least 30 days' notice via email or in-app notice.</li>
        <li style={styles.li}><strong style={styles.strong}>Failed payments:</strong> if payment fails, access to paid features may be suspended until payment succeeds.</li>
      </ul>

      <h2 style={styles.h2}>9. Your Data</h2>
      <p style={styles.p}>
        Your meeting content, transcripts, analyses, leads, and email drafts are stored locally on your devices and
        are yours. You retain all rights to your data. You grant us a limited license to process that data solely
        to provide the Service to you (e.g., relaying transcripts for analysis and sending emails you compose), in
        accordance with our <a href="/privacy" style={{ color: 'var(--accent-primary)' }}>Privacy Policy</a>.
      </p>

      <h2 style={styles.h2}>10. Intellectual Property</h2>
      <p style={styles.p}>
        DealForge, including its software, branding, and documentation, is owned by us and protected by applicable
        intellectual property laws. Except for the license granted in Section 5, no rights are transferred to you.
      </p>

      <h2 style={styles.h2}>11. Third-Party Services</h2>
      <p style={styles.p}>
        The Service integrates with third-party services such as Zoom, Google (Firebase, Gmail, Gemini), Microsoft
        (Outlook), OpenAI, Anthropic, Resend, and Dodo Payments. These services are governed by their own terms and
        privacy policies. We are not responsible for their operation, availability, or handling of data, except as
        required by law.
      </p>

      <h2 style={styles.h2}>12. Termination</h2>
      <p style={styles.p}>
        You may stop using the Service at any time and delete your data as described in our Privacy Policy. We may
        suspend or terminate your access if you breach these Terms, if we suspect fraud or abuse, or if required by
        law. Upon termination of a paid subscription, you retain access to your local data; paid features cease at
        the end of the billing period.
      </p>

      <h2 style={styles.h2}>13. Disclaimer of Warranties</h2>
      <p style={styles.p}>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
        INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT
        AI OUTPUT WILL BE ACCURATE. YOU USE THE SERVICE AT YOUR OWN RISK.
      </p>

      <h2 style={styles.h2}>14. Limitation of Liability</h2>
      <p style={styles.p}>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL DEALFORGE BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING
        OUT OF OR IN CONNECTION WITH THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL
        LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE
        AMOUNT YOU PAID US FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100.
      </p>

      <h2 style={styles.h2}>15. Indemnification</h2>
      <p style={styles.p}>
        You agree to indemnify and hold harmless DealForge and its officers, employees, and agents from any claims,
        damages, liabilities, and expenses (including reasonable attorneys' fees) arising out of your use of the
        Service, your violation of these Terms, your failure to obtain required meeting-recording consent, or your
        violation of any rights of a third party.
      </p>

      <h2 style={styles.h2}>16. Governing Law</h2>
      <p style={styles.p}>
        These Terms are governed by the laws of the jurisdiction in which DealForge is established, without regard
        to conflict-of-law principles. Any disputes shall be resolved in the courts of that jurisdiction, and you
        consent to their exclusive jurisdiction, except where prohibited by law. Nothing in these Terms limits
        rights that cannot be waived under applicable consumer protection law.
      </p>

      <h2 style={styles.h2}>17. Changes to These Terms</h2>
      <p style={styles.p}>
        We may update these Terms from time to time. Material changes will be reflected by an updated "Last
        updated" date at the top of this page and, where appropriate, notified via the app or email. Continued use
        of the Service after changes take effect constitutes acceptance of the revised Terms.
      </p>

      <h2 style={styles.h2}>18. Contact</h2>
      <p style={styles.p}>
        Questions about these Terms: <strong style={styles.strong}>support@dealforge.com</strong>.
      </p>
    </div>
  );
}
