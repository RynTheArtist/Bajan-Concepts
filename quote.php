<?php
/**
 * Bajan Concepts — quote request handler.
 * Works on any standard PHP shared host (cPanel etc.) sending through Spacemail SMTP (login kept outside the web root).
 *
 * EDIT THESE THREE LINES once the Spacemail mailbox exists:
 */
const QUOTE_TO   = 'quotes@bajanconcepts.net, bajaninc@yahoo.com'; // where quote requests are delivered
const CONFIRM_CC = 'bajaninc@yahoo.com';         // copied on each customer confirmation
const MAIL_FROM  = 'quotes@bajanconcepts.net';    // must be a real mailbox/domain on your host
const SITE_NAME  = 'Bajan Concepts';

/* Mail goes out through Spacemail SMTP. The login lives OUTSIDE the web root in
   ~/bajan-private/smtp.php (returns ['host'=>..,'port'=>465,'user'=>..,'pass'=>..]). */
const SMTP_CONFIG = __DIR__ . '/../bajan-private/smtp.php';

function smtp_send(array $rcpts, string $data): bool {
    $c = @include SMTP_CONFIG;
    if (!is_array($c) || empty($c['pass'])) { error_log('quote.php: SMTP config missing'); return false; }
    $host = $c['host'] ?? 'mail.spacemail.com'; $port = (int)($c['port'] ?? 465);
    $fp = @stream_socket_client("ssl://$host:$port", $en, $es, 20, STREAM_CLIENT_CONNECT,
        stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]));
    if (!$fp) { error_log("quote.php: SMTP connect failed $en $es"); return false; }
    stream_set_timeout($fp, 20);
    $read = function () use ($fp) { $r = ''; while (($l = fgets($fp, 515)) !== false) { $r .= $l; if (isset($l[3]) && $l[3] === ' ') break; } return $r; };
    $cmd  = function (string $line, string $expect) use ($fp, $read) {
        if ($line !== '') fwrite($fp, $line . "\r\n");
        $r = $read();
        if (strpos($r, $expect) !== 0) { throw new RuntimeException(trim(preg_replace('/AUTH.*$/s', 'AUTH ***', $line)) . ' -> ' . trim($r)); }
        return $r;
    };
    try {
        $cmd('', '220');
        $cmd('EHLO bajanconcepts.net', '250');
        $cmd('AUTH LOGIN', '334');
        $cmd(base64_encode($c['user']), '334');
        $cmd(base64_encode($c['pass']), '235');
        $cmd('MAIL FROM:<' . MAIL_FROM . '>', '250');
        foreach ($rcpts as $r) { $cmd('RCPT TO:<' . $r . '>', '25'); }
        $cmd('DATA', '354');
        $data = preg_replace('/(?<!\r)\n/', "\r\n", $data);
        $data = preg_replace('/^\./m', '..', $data);
        $cmd($data . "\r\n.", '250');
        $cmd('QUIT', '221');
        fclose($fp); return true;
    } catch (Throwable $e) { error_log('quote.php: SMTP ' . $e->getMessage()); @fclose($fp); return false; }
}

/* Build a full message (headers + body) and send it */
function send_mail(array $to, array $cc, string $subjectEnc, string $headers, string $body): bool {
    $all = "Date: " . date('r') . "\r\nTo: " . implode(', ', $to) . "\r\n"
         . ($cc ? "Cc: " . implode(', ', $cc) . "\r\n" : '')
         . "Subject: $subjectEnc\r\nMessage-ID: <" . bin2hex(random_bytes(12)) . "@bajanconcepts.net>\r\n"
         . $headers . "\r\n\r\n" . $body;
    return smtp_send(array_merge($to, $cc), $all);
}

/* ------------------------------------------------------------------ */
$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function done(bool $ok, string $msg, bool $json, int $code = 200): void {
    if ($json) {
        http_response_code($ok ? 200 : $code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $msg]);
    } else {
        header('Location: ./?' . ($ok ? 'sent=1' : 'error=1') . '#quote');
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { done(false, 'Invalid request.', $wantsJson, 405); }

/* Bot checks: honeypot + too-fast submit */
if (!empty($_POST['website'])) { done(true, '', $wantsJson); }                 // pretend success
$ts = (int)($_POST['ts'] ?? 0);
if ($ts && (time() - $ts) < 4) { done(false, 'Please take a moment to complete the form.', $wantsJson, 429); }

/* Simple per-IP rate limit: 5 requests / hour */
$dataDir = __DIR__ . '/_data';
if (!is_dir($dataDir)) { @mkdir($dataDir, 0750, true); }
if (!file_exists($dataDir . '/.htaccess')) { @file_put_contents($dataDir . '/.htaccess', "Require all denied\nDeny from all\n"); }
$ipKey = $dataDir . '/rl_' . md5($_SERVER['REMOTE_ADDR'] ?? 'x') . '.txt';
$hits  = array_filter(array_map('intval', @file($ipKey, FILE_IGNORE_NEW_LINES) ?: []), fn($t) => $t > time() - 3600);
if (count($hits) >= 5) { done(false, 'Too many requests. Please call us instead.', $wantsJson, 429); }
$hits[] = time(); @file_put_contents($ipKey, implode("\n", $hits));

/* Sanitize */
function clean(string $v, int $max = 2000): string {
    $v = trim(str_replace(["\r", "\0"], '', $v));
    return mb_substr($v, 0, $max);
}
function oneLine(string $v, int $max = 200): string { return preg_replace('/[\r\n]+/', ' ', clean($v, $max)); }

$name   = oneLine($_POST['name']  ?? '', 100);
$email  = oneLine($_POST['email'] ?? '', 150);
$phone  = oneLine($_POST['phone'] ?? '', 40);
$year   = oneLine($_POST['year']  ?? '', 6);
$make   = oneLine($_POST['make']  ?? '', 60);
$model  = oneLine($_POST['model'] ?? '', 60);
$concept= clean($_POST['concept'] ?? '', 4000);
$budget = oneLine($_POST['budget']   ?? '', 40);
$time   = oneLine($_POST['timeline'] ?? '', 40);
$pref   = oneLine($_POST['contact_pref'] ?? 'Email', 20);
$parts  = array_map(fn($p) => oneLine((string)$p, 40), (array)($_POST['parts'] ?? []));
$isOther    = in_array('Other', $parts, true);
$otherTypes = array_map(fn($p) => oneLine((string)$p, 40), array_slice((array)($_POST['other_types'] ?? []), 0, 8));
$otherDesc  = clean((string)($_POST['other_desc'] ?? ''), 500);

$projectOk = $isOther ? (count($otherTypes) > 0 || $otherDesc !== '') : ($make !== '' && $model !== '');
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$projectOk || $concept === '') {
    done(false, 'Please fill in your name, email, what you want painted and your concept.', $wantsJson, 422);
}
$what = $isOther
    ? 'Custom piece' . ($otherTypes ? ' (' . mb_substr(implode(', ', $otherTypes), 0, 60) . ')' : '')
    : trim("$year $make $model");

/* Attachments (images only, max 4 × 6 MB) */
$attachments = [];
if (!empty($_FILES['photos']['name'][0])) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    foreach (array_slice(array_keys($_FILES['photos']['name']), 0, 4) as $i) {
        if ($_FILES['photos']['error'][$i] !== UPLOAD_ERR_OK) { continue; }
        $tmp = $_FILES['photos']['tmp_name'][$i];
        if (!is_uploaded_file($tmp) || $_FILES['photos']['size'][$i] > 6 * 1024 * 1024) { continue; }
        $mime = $finfo->file($tmp);
        if (!isset($allowed[$mime])) { continue; }
        $attachments[] = ['mime' => $mime, 'name' => 'reference-' . ($i + 1) . '.' . $allowed[$mime], 'data' => chunk_split(base64_encode(file_get_contents($tmp)))];
    }
}

/* Build the email to the shop */
$body  = "NEW QUOTE REQUEST\n=================\n\n";
$body .= "Name:    $name\nEmail:   $email\nPhone:   " . ($phone ?: '—') . "\nContact: $pref\n\n";
if ($isOther) {
    $body .= "Project: OTHER (custom piece)\nType:    " . ($otherTypes ? implode(', ', $otherTypes) : '—') . "\nDetails: " . ($otherDesc ?: '—') . "\n";
} else {
    $body .= "Bike:    " . trim("$year $make $model") . "\nParts:   " . ($parts ? implode(', ', $parts) : '—') . "\n";
}
$body .= "Budget:  " . ($budget ?: '—') . "\nTimeline:" . ($time ?: ' Flexible') . "\n\nCONCEPT\n-------\n$concept\n\n";
$body .= "Photos attached: " . count($attachments) . "\n";

$subject = 'Quote request: ' . $what . " — $name";
$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'bajanconcepts.net');
$headers = [
    'From: ' . SITE_NAME . ' <' . MAIL_FROM . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'X-Mailer: bajanconcepts-quote/1.0',
];

if ($attachments) {
    $b = 'bc_' . bin2hex(random_bytes(8));
    $headers[] = "Content-Type: multipart/mixed; boundary=\"$b\"";
    $msg  = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$body\r\n";
    foreach ($attachments as $a) {
        $msg .= "--$b\r\nContent-Type: {$a['mime']}; name=\"{$a['name']}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$a['name']}\"\r\n\r\n{$a['data']}\r\n";
    }
    $msg .= "--$b--";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $msg = $body;
}

$subjectEnc = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$sent = send_mail(array_map('trim', explode(',', QUOTE_TO)), [], $subjectEnc, implode("\r\n", $headers), $msg);

/* Always keep a backup copy so no lead is lost if mail delivery hiccups */
@file_put_contents($dataDir . '/quotes.jsonl',
    json_encode(['t' => date('c'), 'name' => $name, 'email' => $email, 'phone' => $phone, 'bike' => "$year $make $model",
                 'parts' => $parts, 'other_types' => $otherTypes, 'other_desc' => $otherDesc, 'budget' => $budget, 'timeline' => $time, 'pref' => $pref, 'concept' => $concept,
                 'photos' => count($attachments), 'mailed' => (bool)$sent]) . "\n", FILE_APPEND | LOCK_EX);

if (!$sent) { done(false, 'Our mail server had a hiccup.', $wantsJson, 500); }

/* Confirmation to the customer */
$ack  = "Hi $name,\n\nThanks for requesting a quote from " . SITE_NAME . ". We received your request for "
      . ($isOther ? 'your custom piece' : 'your ' . $what) . " and will review it and reply soon.\n\n"
      . "If you have more reference photos or ideas, just reply to this email.\n\n— " . SITE_NAME . "\nSierra Vista, AZ\n";
send_mail([$email], [CONFIRM_CC], '=?UTF-8?B?' . base64_encode('We got your quote request — ' . SITE_NAME) . '?=',
      "From: " . SITE_NAME . " <" . MAIL_FROM . ">\r\nReply-To: " . MAIL_FROM . "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8", $ack);

done(true, '', $wantsJson);
