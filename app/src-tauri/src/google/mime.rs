//! Builds the RFC 5322 message that becomes a Gmail draft, encoded as the
//! base64url `raw` string the Gmail API expects.
use base64::engine::general_purpose::{STANDARD, URL_SAFE};
use base64::Engine as _;

/// Makes text safe for a single header line: line breaks and other control
/// characters (header injection) become spaces, and runs of whitespace are
/// collapsed.
fn header_safe(value: &str) -> String {
    value
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// RFC 2047 encoded-word for non-ASCII header text (e.g. "£" or accented names).
fn encode_header_text(value: &str) -> String {
    if value.is_ascii() {
        value.to_string()
    } else {
        format!("=?UTF-8?B?{}?=", STANDARD.encode(value.as_bytes()))
    }
}

/// A plain address list for the To header: only characters valid in simple
/// email addresses, commas and spaces. Anything else is rejected upstream.
pub fn valid_recipients(to: &str) -> bool {
    !to.is_empty()
        && to.len() <= 320
        && to.split(',').all(|a| {
            let a = a.trim();
            let mut parts = a.split('@');
            matches!((parts.next(), parts.next(), parts.next()), (Some(l), Some(d), None) if !l.is_empty() && d.contains('.'))
                && a.chars().all(|c| c.is_ascii_alphanumeric() || "@.+-_'".contains(c))
        })
}

/// The whole message, base64url-encoded for `users.drafts.create`.
pub fn raw_message(to: Option<&str>, subject: &str, body: &str) -> String {
    let mut msg = String::new();
    if let Some(to) = to.map(header_safe).filter(|t| valid_recipients(t)) {
        msg.push_str(&format!("To: {to}\r\n"));
    }
    msg.push_str(&format!(
        "Subject: {}\r\n",
        encode_header_text(&header_safe(subject))
    ));
    msg.push_str("MIME-Version: 1.0\r\n");
    msg.push_str("Content-Type: text/plain; charset=\"UTF-8\"\r\n");
    msg.push_str("Content-Transfer-Encoding: base64\r\n\r\n");
    let normalized = body.replace("\r\n", "\n").replace('\n', "\r\n");
    let encoded = STANDARD.encode(normalized.as_bytes());
    for chunk in encoded.as_bytes().chunks(76) {
        msg.push_str(std::str::from_utf8(chunk).expect("base64 is ASCII"));
        msg.push_str("\r\n");
    }
    URL_SAFE.encode(msg.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decode(raw: &str) -> String {
        String::from_utf8(URL_SAFE.decode(raw).unwrap()).unwrap()
    }

    fn body_of(message: &str) -> String {
        let (_, b64) = message.split_once("\r\n\r\n").unwrap();
        String::from_utf8(STANDARD.decode(b64.replace("\r\n", "")).unwrap()).unwrap()
    }

    #[test]
    fn plain_subject_and_utf8_body() {
        let m = decode(&raw_message(
            None,
            "Invoice for Piano Lessons",
            "Hi Jo,\n\n8 x £20.00 = £160.00",
        ));
        assert!(m.starts_with("Subject: Invoice for Piano Lessons\r\nMIME-Version: 1.0\r\n"));
        assert!(m.contains("Content-Type: text/plain; charset=\"UTF-8\""));
        assert!(!m.contains("To:"));
        assert_eq!(body_of(&m), "Hi Jo,\r\n\r\n8 x £20.00 = £160.00");
    }

    #[test]
    fn subject_header_injection_is_neutralised() {
        let m = decode(&raw_message(
            None,
            "Invoice\r\nBcc: attacker@example.com",
            "x",
        ));
        let head = m.split("\r\n\r\n").next().unwrap();
        assert!(!head.lines().any(|l| l.starts_with("Bcc:")));
        assert!(head.contains("Subject: Invoice Bcc: attacker@example.com"));
    }

    #[test]
    fn non_ascii_subject_is_rfc2047_encoded() {
        let m = decode(&raw_message(None, "Zoë's lessons £", "x"));
        let subject = m.lines().find(|l| l.starts_with("Subject:")).unwrap();
        assert!(subject.starts_with("Subject: =?UTF-8?B?"));
        let b64 = subject
            .trim_start_matches("Subject: =?UTF-8?B?")
            .trim_end_matches("?=");
        assert_eq!(
            String::from_utf8(STANDARD.decode(b64).unwrap()).unwrap(),
            "Zoë's lessons £"
        );
    }

    #[test]
    fn recipient_only_when_valid() {
        let m = decode(&raw_message(Some("parent@example.com"), "s", "b"));
        assert!(m.starts_with("To: parent@example.com\r\n"));
        let m = decode(&raw_message(
            Some("x@example.com\r\nBcc: y@evil.com"),
            "s",
            "b",
        ));
        assert!(!m.contains("To:") && !m.contains("Bcc"));
        assert!(!valid_recipients("not-an-address"));
        assert!(valid_recipients("a@b.co, c.d+e@f.org"));
    }

    #[test]
    fn raw_is_url_safe() {
        let raw = raw_message(None, "?>?>?>", "ÿÿÿ~~~");
        assert!(!raw.contains('+') && !raw.contains('/'));
    }
}
