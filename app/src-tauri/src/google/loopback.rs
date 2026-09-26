//! Parsing and responses for the one-shot local HTTP server that receives
//! Google's sign-in redirect (`http://127.0.0.1:<port>/?code=…&state=…`).
//! Pure functions so the security-relevant parsing is unit-tested.
use url::Url;

/// Maximum bytes read from one connection before giving up.
pub const MAX_REQUEST_BYTES: usize = 8 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum Callback {
    /// The redirect carried an authorization code with the expected `state`.
    Code(String),
    /// Google reported an error, e.g. the user pressed Cancel (`access_denied`).
    Denied(String),
    /// A callback whose `state` is missing or wrong: not ours, ignore it.
    BadState,
    /// Anything else (favicon, other paths, malformed requests).
    NotFound,
}

/// Extracts the request target from the first line of an HTTP request head.
/// Only `GET` is accepted.
pub fn request_target(head: &str) -> Option<&str> {
    let line = head.lines().next()?;
    let mut parts = line.split(' ');
    let method = parts.next()?;
    let target = parts.next()?;
    let version = parts.next()?;
    if method != "GET" || !version.starts_with("HTTP/1.") || parts.next().is_some() {
        return None;
    }
    target.starts_with('/').then_some(target)
}

/// Decides what a request target means for the pending sign-in.
pub fn classify(target: &str, expected_state: &str) -> Callback {
    let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::NotFound;
    };
    if url.path() != "/" {
        return Callback::NotFound;
    }
    let mut code = None;
    let mut state = None;
    let mut error = None;
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "code" if code.is_none() => code = Some(v.into_owned()),
            "state" if state.is_none() => state = Some(v.into_owned()),
            "error" if error.is_none() => error = Some(v.into_owned()),
            _ => {}
        }
    }
    if code.is_none() && error.is_none() {
        return Callback::NotFound;
    }
    // Constant-time comparison is unnecessary here (the state is single-use
    // and only valid for a few minutes), but the check itself is essential:
    // it stops another page from injecting its own code (login CSRF).
    if state.as_deref() != Some(expected_state) {
        return Callback::BadState;
    }
    match (code, error) {
        (_, Some(e)) => Callback::Denied(e),
        (Some(c), None) if !c.is_empty() && c.len() <= 512 => Callback::Code(c),
        _ => Callback::NotFound,
    }
}

/// A complete HTTP/1.1 response with a small self-contained HTML page.
pub fn response(status: u16, title: &str, message: &str) -> Vec<u8> {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Error",
    };
    let body = format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>{title}</title>\
         <style>body{{font-family:Segoe UI,system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1f2937}}\
         h1{{font-size:1.4rem}}</style></head><body><h1>{title}</h1><p>{message}</p></body></html>"
    );
    format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
    .into_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_from_request_line() {
        assert_eq!(
            request_target("GET /?code=a HTTP/1.1\r\nHost: x\r\n\r\n"),
            Some("/?code=a")
        );
        assert_eq!(request_target("POST / HTTP/1.1\r\n"), None);
        assert_eq!(request_target("GET http://evil/ HTTP/1.1\r\n"), None);
        assert_eq!(request_target("GET / HTTP/1.1 extra\r\n"), None);
        assert_eq!(request_target(""), None);
    }

    #[test]
    fn accepts_code_with_matching_state() {
        assert_eq!(
            classify("/?state=s1&code=4%2F0Ab_c", "s1"),
            Callback::Code("4/0Ab_c".into())
        );
        // code as the last parameter is not polluted by the HTTP version
        assert_eq!(
            classify("/?state=s1&code=abc", "s1"),
            Callback::Code("abc".into())
        );
    }

    #[test]
    fn rejects_wrong_or_missing_state() {
        assert_eq!(classify("/?code=abc&state=other", "s1"), Callback::BadState);
        assert_eq!(classify("/?code=abc", "s1"), Callback::BadState);
    }

    #[test]
    fn reports_denial() {
        assert_eq!(
            classify("/?error=access_denied&state=s1", "s1"),
            Callback::Denied("access_denied".into())
        );
        assert_eq!(
            classify("/?error=access_denied&state=x", "s1"),
            Callback::BadState
        );
    }

    #[test]
    fn ignores_other_paths_and_lookalikes() {
        assert_eq!(classify("/favicon.ico", "s1"), Callback::NotFound);
        assert_eq!(
            classify("/auth/callback?code=abc&state=s1", "s1"),
            Callback::NotFound
        );
        assert_eq!(classify("/?xcode=abc&state=s1", "s1"), Callback::NotFound);
        assert_eq!(classify("/", "s1"), Callback::NotFound);
    }

    #[test]
    fn handles_non_ascii_without_panicking() {
        assert_eq!(
            classify("/?code=aaaaaaaaaaaaaaaaaaa%C3%A9&state=s1", "s1"),
            Callback::Code("aaaaaaaaaaaaaaaaaaaé".into())
        );
        assert_eq!(
            classify("/?code=%FF%FE&state=s1", "s1"),
            Callback::Code("\u{FFFD}\u{FFFD}".into())
        );
    }

    #[test]
    fn rejects_oversized_code() {
        let long = "a".repeat(600);
        assert_eq!(
            classify(&format!("/?code={long}&state=s1"), "s1"),
            Callback::NotFound
        );
    }

    #[test]
    fn response_has_length_and_closes() {
        let r = String::from_utf8(response(200, "Done", "You can close this tab.")).unwrap();
        let (head, body) = r.split_once("\r\n\r\n").unwrap();
        assert!(head.starts_with("HTTP/1.1 200 OK"));
        assert!(head.contains(&format!("Content-Length: {}", body.len())));
        assert!(head.contains("Connection: close"));
    }
}
