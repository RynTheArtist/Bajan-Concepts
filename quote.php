<?php
/**
 * Bajan Concepts — quote request handler.
 * Works on any standard PHP shared host (cPanel etc.) using the built-in mail().
 *
 * EDIT THESE THREE LINES once the Spacemail mailbox exists:
 */
const QUOTE_TO   = 'bajaninc@yahoo.com';          // where quote requests are delivered
const MAIL_FROM  = 'quotes@bajanconcepts.net';    // must be a real mailbox/domain on your host
const SITE_NAME  = 'Bajan Concepts';

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

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $make === '' || $model === '' || $concept === '') {
    done(false, 'Please fill in your name, email, bike and concept.', $wantsJson, 422);
}

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
$body .= "Bike:    " . trim("$year $make $model") . "\nParts:   " . ($parts ? implode(', ', $parts) : '—') . "\n";
$body .= "Budget:  " . ($budget ?: '—') . "\nTimeline:" . ($time ?: ' Flexible') . "\n\nCONCEPT\n-------\n$concept\n\n";
$body .= "Photos attached: " . count($attachments) . "\n";

$subject = 'Quote request: ' . trim("$year $make $model") . " — $name";
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
$sent = @mail(QUOTE_TO, $subjectEnc, $msg, implode("\r\n", $headers), '-f' . MAIL_FROM);

/* Always keep a backup copy so no lead is lost if mail delivery hiccups */
@file_put_contents($dataDir . '/quotes.jsonl',
    json_encode(['t' => date('c'), 'name' => $name, 'email' => $email, 'phone' => $phone, 'bike' => "$year $make $model",
                 'parts' => $parts, 'budget' => $budget, 'timeline' => $time, 'pref' => $pref, 'concept' => $concept,
                 'photos' => count($attachments), 'mailed' => (bool)$sent]) . "\n", FILE_APPEND | LOCK_EX);

if (!$sent) { done(false, 'Our mail server had a hiccup.', $wantsJson, 500); }

/* Confirmation to the customer */
$ack  = "Hi $name,\n\nThanks for requesting a quote from " . SITE_NAME . ". We received your request for your "
      . trim("$year $make $model") . " and will review it and reply soon.\n\n"
      . "If you have more reference photos or ideas, just reply to this email.\n\n— " . SITE_NAME . "\nSierra Vista, AZ\n";
@mail($email, '=?UTF-8?B?' . base64_encode('We got your quote request — ' . SITE_NAME) . '?=', $ack,
      "From: " . SITE_NAME . " <" . MAIL_FROM . ">\r\nReply-To: " . QUOTE_TO . "\r\nContent-Type: text/plain; charset=UTF-8", '-f' . MAIL_FROM);

done(true, '', $wantsJson);
