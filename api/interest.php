<?php
declare(strict_types=1);
// Interest requests only; never treats a signup as a reserved place.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status, array $body): void { http_response_code($status); echo json_encode($body); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST'); reply(405, ['error'=>'Use the signup form.']); }
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://fast.jacobcloete.pro', 'http://127.0.0.1:8778', 'http://localhost:8778'];
if ($origin !== '' && !in_array($origin, $allowed, true)) reply(403, ['error'=>'Please use the form on the FAST website.']);
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') reply(403, ['error'=>'Please use the FAST website.']);
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) reply(415, ['error'=>'JSON required.']);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096) reply(413, ['error'=>'Request too large.']);
$raw=file_get_contents('php://input', false, null, 0, 4097);
if ($raw === false || strlen($raw)>4096) reply(413, ['error'=>'Request too large.']);
$data=json_decode($raw,true);
if (!is_array($data)) reply(400, ['error'=>'Please check the form and try again.']);
try {
    require __DIR__.'/storage.php';
    $db=fast_db();
    // All rate limits and writes share a lock, so concurrent submissions cannot bypass them.
    $db->exec('BEGIN IMMEDIATE');
    $now=time();
    $db->prepare('DELETE FROM interests WHERE expires_at < ?')->execute([$now]);
    $db->prepare('DELETE FROM requests WHERE at < ?')->execute([$now-3600]);
    $ip=hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', fast_salt());
    $s=$db->prepare('SELECT COUNT(*) FROM requests WHERE ip_hash = ?');$s->execute([$ip]);
    if ((int)$s->fetchColumn()>=15) { $db->exec('ROLLBACK'); header('Retry-After: 3600'); reply(429,['error'=>'Too many attempts. Please try again in an hour.']); }
    $db->prepare('INSERT INTO requests(ip_hash,at) VALUES (?,?)')->execute([$ip,$now]);
    if (($data['action'] ?? '') === 'withdraw') {
        $token=is_string($data['token'] ?? null)?$data['token']:'';
        if (!preg_match('/^[a-f0-9]{64}$/D',$token)) { $db->exec('COMMIT');reply(400,['error'=>'This private signup link is invalid.']); }
        $db->prepare('DELETE FROM interests WHERE token_hash = ?')->execute([hash('sha256',$token)]);
        $db->exec('COMMIT');reply(200,['ok'=>true]);
    }
    if (!empty($data['website'])) { $db->exec('COMMIT');reply(400,['error'=>'Please leave the extra field empty.']); }
    $name=is_string($data['name'] ?? null)?trim($data['name']):'';
    $email=is_string($data['email'] ?? null)?strtolower(trim($data['email'])):'';
    $trip=is_string($data['trip'] ?? null)?$data['trip']:'';
    $trips=json_decode(file_get_contents(dirname(__DIR__).'/data/adventures.json'),true)['trips'];
    $chosen=null;foreach($trips as $t)if($t['id']===$trip)$chosen=$t;
    if (!$chosen || $chosen['status']!=='proposed' || $name==='' || strlen($name)>240 || preg_match('/[\x00-\x1F\x7F]/',$name) || strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL) || ($data['consent']??false)!==true) {
        $db->exec('COMMIT');reply(422,['error'=>'Add your name, a valid email and permission to contact you about the selected trip.']);
    }
    $departure=strtotime('1 '.$chosen['month'].' '.$chosen['year'].' UTC');
    if ($departure<$now) { $db->exec('COMMIT');reply(422,['error'=>'Interest for this departure is closed.']); }
    $s=$db->prepare('SELECT id FROM interests WHERE trip=? AND email=?');$s->execute([$trip,$email]);
    if ($s->fetchColumn()) { $db->exec('COMMIT');reply(200,['ok'=>true]); }
    $token=bin2hex(random_bytes(32));
    $db->prepare('INSERT INTO interests(trip,name,email,created_at,expires_at,consent_version,token_hash,status) VALUES (?,?,?,?,?,?,?,?)')->execute([$trip,$name,$email,$now,strtotime('+4 months',$departure),'2026-09-28',hash('sha256',$token),'interested']);
    $db->exec('COMMIT');reply(201,['ok'=>true,'manageToken'=>$token]);
} catch (Throwable $e) {
    if (isset($db)) { try { $db->exec('ROLLBACK'); } catch(Throwable $ignored) {} }
    // Never send storage paths, user data or exception details to the browser.
    error_log('FAST interest storage unavailable');
    reply(503,['error'=>'Signup is temporarily unavailable. Your place has not been reserved. Please try again later.']);
}
